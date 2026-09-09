# Handoff: League Dashboard — Frontend + Draft API Integration

## Context

Builds on `fpl.predictions` (specifically `gameweeks_ahead = 1` for this task), `fpl.players`, and `fpl.features` (for `position`). New piece: live integration with FPL **Draft's** API (`draft.premierleague.com` — a separate API from Classic FPL's `fantasy.premierleague.com`, do not assume they share endpoint shapes). Architecture: a **FastAPI backend, deployed as Python serverless functions on Vercel**, acting as a server-side proxy — Draft's API cannot be called directly from a browser (CORS-blocked, confirmed for Classic's API and near-certainly true for Draft's given they're run by the same team). The Next.js frontend stays as-is and calls this backend for data; the two are separate concerns in the same Vercel deployment, same-origin, no CORS configuration needed between them (only between the FastAPI backend and Draft's external API, which is what it exists to work around). This is live-fetched per page load, not part of the batch GitHub Actions pipeline — team rosters, schedules, and ownership are inherently request-time data, unlike predictions.

Deployment shape: one FastAPI `app` instance handling all routes under `/api/fpl/*` via FastAPI's own router (a single Python entry point, not one file per route) — check how the existing Vercel project is configured for Python functions before adding a new pattern; if none exists yet, this is the first one and should be set up cleanly rather than per-route.

Convention: snake_case for FastAPI path parameters and JSON response fields (idiomatic for Python/FastAPI/Pydantic) — the Next.js frontend consumes these as-is rather than transforming to camelCase, to avoid an unnecessary translation layer at the API boundary.

**Roster source and an accepted trade-off**: rosters come from `entry/{teamId}/event/{gw}/picks/` for the most recently *completed* gameweek — confirmed structurally sound against real data (see Task 0). This means a trade or waiver move made after that gameweek locked won't be reflected until the next gameweek locks. That staleness is accepted, not solved — but the frontend must surface it (Task 5), so nobody mistakes a few-days-old roster for a live one.

**This handoff now includes the starting-XI optimizer** — originally scoped as later, separate work, but it turns out the panel isn't very useful without it (a flat list of 15 players tells you less than which 11 should actually start). Folded into Task 2 below. The waiver-gain-ranking piece from the original roadmap remains separate, later work — nothing here requires it.

## Task 0: verify the real API before writing implementation code

Roster source is settled: `entry/{teamId}/event/{gw}/picks/` for the most recently completed gameweek (confirmed working: `entry/67501/event/3/picks/` returned a real 15-player roster with `element`/`position`/`is_captain`/`is_vice_captain`/`multiplier` per pick — `is_captain`/`is_vice_captain` both `false` across the board, consistent with Draft having no captaincy). Two things still need confirming before implementation starts:

1. **Auth**: fetch that same URL from an environment with no Draft login/session (e.g. `curl` with no cookies, or an incognito browser tab) and confirm it returns the same data. If it does, no authentication is needed anywhere in this feature. If it doesn't, stop and flag it back — the fix (likely a single shared service account, session token stored as a secret like `SUPABASE_SERVICE_ROLE_KEY`) changes the multi-user design, not just an implementation detail.
2. **Schedule and ownership**: fetch `league/{leagueId}/details` and inspect what its `matches` field actually contains — confirm whether it's the H2H schedule needed for Task 3. Separately, look for any league-wide player-ownership endpoint (needed for Task 4's availability filter); none has been confirmed to exist yet. **Claude Code should attempt these fetches directly** (its local environment has normal network access, unlike this chat's sandboxed tools) rather than waiting on manual browser checks — try `curl`/`fetch` against real endpoints using the league/team IDs already confirmed working, and report back what each actually returns before building against assumed shapes.

Save whatever real response shapes get confirmed as reference fixtures in the repo.

## Task 1: player identity resolution

Draft's roster/ownership responses will identify players by their per-season `element` id — same unstable numbering, same underlying player database, as Classic's `bootstrap-static`. Resolve `element` → `code` by fetching `bootstrap-static` live (cheap, cacheable) and joining in memory, then use `code` for every downstream join against `fpl.players`/`fpl.predictions`. Do not persist a new "current element id" column in Supabase to avoid this lookup — storing a season-scoped id is exactly the shape of the original player-identity bug; there's no need to store what's cheap to resolve at request time.

## Task 2: FastAPI route — team roster, xPts, and starting XI

`GET /api/fpl/team/{team_id}`: given a Draft team id, fetch its roster from the most recently completed gameweek's picks (Task 0), resolve identities (Task 1), join to `fpl.predictions` where `gameweeks_ahead = 1`, compute per-player `adjusted_xpts`.

Apply the `chance_of_playing` discount here, not in the model:

```
adjusted_xpts = xpts_mean * (chance_of_playing / 100) if chance_of_playing is not null else xpts_mean
```

Return both the raw `xpts_mean` and the `adjusted_xpts`, plus the raw `chance_of_playing` value — the frontend should be able to show *why* a number was discounted, not just present the discounted figure silently.

**Then select the best-scoring valid starting XI from the 15-player roster** — formation rules: exactly 1 GKP, DEF 3-5, MID 2-5, FWD 1-3, 11 starters total, remaining 4 on the bench.

Don't reach for PuLP here even though it's directly available in this Python backend — the reason isn't a language mismatch (there isn't one), it's that the problem is smaller than what a general LP solver is for. It decomposes cleanly: for any fixed valid split of (DEF count, MID count, FWD count) summing to 10, the optimal selection for that split is simply the top-N roster players by `adjusted_xpts` within each position — no cross-position interaction to solve for. So: enumerate every valid `(def, mid, fwd)` combination within the bounds above that sums to 10, take the top-N per position for each, keep whichever combination scores highest overall. This is exact, not a heuristic — genuinely optimal given the constraints, just solved directly instead of through a general-purpose solver, and it avoids solver-call overhead on a route that runs live on every page load rather than once a week. PuLP remains the right choice for the waiver recommender elsewhere in the roadmap, where the tradeoffs are actually cross-player; it's just not what this specific problem needs.

Order the 4 bench players by descending `adjusted_xpts` (same convention as originally specified for auto-substitution ordering). Return the starting XI, the ordered bench, and the team's total `adjusted_xpts` (sum over the 11 starters only).

## Task 3: FastAPI route — league + schedule

`GET /api/fpl/league/{league_id}`: given a league id, return the list of teams (id + name), and separately this gameweek's H2H schedule, so the frontend can resolve "my opponent" from "my team" plus this week's matchup.

## Task 4: FastAPI route — league-wide availability

`GET /api/fpl/league/{league_id}/availability`: determine which players are owned by no team in this league (available for pickup). Prefer a single league-wide ownership endpoint if Task 0's discovery finds one — strongly preferred over fetching every team's roster individually and diffing, which doesn't scale past a handful of teams.

## Task 5: frontend pages

`/app/fpl/team`: league id input, defaulting to a new `DEFAULT_LEAGUE_ID` config.py-equivalent constant on the frontend side (same pattern as `CURRENT_SEASON` — a value you update by hand, not derived). Team picker populated from Task 3. Renders a "my team" panel (Task 2 — starting XI + bench, not just a flat roster list) and an "opponent" panel (same, called with the opponent's team id resolved via Task 3's schedule). Both panels must show which completed gameweek the roster was fetched from (e.g. "roster as of GW3") — the accepted staleness trade-off from the Context section needs to be visible to whoever's using this, not just documented in a handoff file nobody using the site will read.

`/app/fpl/players`: table over `fpl.predictions` (`gameweeks_ahead = 1`) joined to `fpl.players`/`position`, with filters for position, team, and availability (Task 4).

## Out of scope

The waiver-gain-ranking logic from the original roadmap (comparing bench/free-agent value over a multi-gameweek horizon) — genuinely separate, later work, since it needs the multi-gameweek horizon this handoff doesn't touch. The multi-gameweek horizon itself (`gameweeks_ahead` 2-5) isn't shown anywhere here either — the players browser could reasonably grow that later, but every panel in this handoff is next-gameweek-only.
