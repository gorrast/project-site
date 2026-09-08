# Handoff v2: FPL Data Ingestion Pipeline — fixture-grain rewrite

This supersedes the original ingestion handoff. Attach `fpl-schema.sql` (already applied to Supabase — the definitive source of truth for table structure, don't re-derive shapes from this doc) and the existing `/pipeline` directory when starting this task. **Revise the existing scripts in place** where the underlying logic still applies (CSV parsing, upsert patterns, Supabase auth setup) — don't discard working code just because the schema moved.

## Critical bugfix: player identity is broken across seasons — fix this before anything else

A real data-corruption bug was found by inspecting live Supabase data: `fpl.players` was keyed on FPL's per-season `id`/`element` field, which gets **reassigned every season**. Confirmed directly against the source data: element id `1` is Folarin Balogun in 2023-24, Fábio Vieira in 2024-25, and David Raya in 2025-26. Three different real players' historical stats are currently stacked under one identity in `raw_gameweek_stats`, and `fpl.players` only reflects whichever backfill or sync happened to run most recently.

**Do not fix this with name matching.** Names aren't reliably stable either — in this same data, David Raya's own `second_name` is stored as `"Raya Martin"` in one season's file and `"Raya Martín"` in another. Name matching would fail on exactly the case it's meant to solve, and unlike an ID collision, a bad name match doesn't error — it silently merges two different people.

**The fix: use FPL's own `code` field**, confirmed stable across seasons for the same real player — David Raya is `id=113`/`code=154561` in 2023-24 and `id=1`/`code=154561` in 2025-26, same code both times. `fpl.players` is now keyed on `code`, not `id` (already updated in `fpl-schema.sql`).

**Run this before re-running any backfill:**

```sql
alter table fpl.players rename column id to code;
truncate table fpl.players cascade; -- wipes players + everything FK'd to it (raw_gameweek_stats, features, predictions). fixture_odds is untouched — it has no player reference.
```

**Fix for `backfill_historical.py`**: `merged_gw.csv` only has the per-season `element` column, not `code`. For each season, also fetch that season's `players_raw.csv` (`.../data/{season}/players_raw.csv`, same repo), which has both `id` (matches `merged_gw.csv`'s `element` for that season) and `code`. Join on `element == id` within each season to resolve `code`, and write `code` — never the raw `element` value — as the key for both `fpl.players` and `raw_gameweek_stats.player_id`.

**Fix for `sync_current_season.py`**: this script shows no symptoms yet, because the corruption only appears *across* seasons and this script has only ever run within one — but the underlying bug is identical. `bootstrap-static`'s `elements[]` already includes `code` directly (no extra fetch needed), so switch to writing `elements[].code` instead of `elements[].id`. Fix this now, not after the fact — otherwise the same corruption reappears the moment this season's `id` values get reassigned next August.

Re-run `backfill_historical.py` once fixed; `sync_current_season.py` self-corrects on its next scheduled run.

## What changed since the original handoff, and why

- `raw_gameweek_stats`'s primary key moved from `(player_id, season, gw)` to `(player_id, season, fixture)`. A team can play twice in one FPL gameweek (a "double gameweek") — the old key collides when that happens.
- `team` and `position` are captured per-row (per fixture actually played), not looked up from `fpl.players` — both can change over time and must reflect what was true *at that fixture*, not today.
- `starts` and `clean_sheets` are boolean, not int — confirmed always 0/1 at fixture grain (this wasn't true at the old gameweek grain, which is part of why the grain was wrong).
- `opponent_team` is text, not int — FPL's numeric team ids get reassigned each season.
- New table `fpl.fixture_odds`, fed by a new data source (an odds API) not covered in the original handoff at all.
- `fpl.features` and `fpl.predictions` exist now too, but populating them is explicitly **out of scope** for this handoff — same boundary as before, just restated because the schema now includes them.

## The double-gameweek data problem, and the fix

FPL's `/api/event/{gw}/live/` endpoint returns stats **aggregated per player across the whole gameweek**, not broken out per fixture — for a double-gameweek player it gives you the *sum* of both matches, with no way to split it back apart. But our table needs one row per fixture. Calling the per-player `/api/element-summary/{id}/` endpoint (which does have fixture-level detail) for all ~700 players every run is too expensive to justify — but double gameweeks only ever affect a handful of teams at a time, so the fix is to only pay that cost for the players who actually need it:

1. Pull `/api/fixtures/?event={gw}` first. Group by team to find which teams (if any) have more than one fixture this gameweek.
2. For players whose team has exactly one fixture this gameweek (the normal case): use the bulk `/api/event/{gw}/live/` stats directly — cheap, one call covers everyone. `was_home`/`opponent_team`/`fixture` come unambiguously from that team's single fixture entry.
3. For players whose team has two fixtures this gameweek (rare): call `/api/element-summary/{id}/` only for those specific players to get the true per-fixture breakdown, and write two rows for them instead of one.

## Task 1: `pipeline/backfill_historical.py` (revise existing)

- Still one-time / manually triggered, still loops the same list of season strings, still reads `merged_gw.csv` per season.
- Update the write logic for the new key: each CSV row already represents one fixture (`fixture` column) — write it as one row in `raw_gameweek_stats` keyed on `(player_id, season, fixture)`, not aggregated by gameweek. This is likely *simpler* than whatever aggregation logic may have existed before, since the source data was already fixture-grain — the old code may have been artificially grouping rows that shouldn't have been grouped.
- Map `starts` and `clean_sheets` to actual booleans on write (source CSV has them as 0/1 ints).
- Continue upserting `fpl.players` from each row's `name`/`team`/`position`, same as before — but note `players.team`/`players.position` are now named `current_team`/`current_position`.
- Columns with no equivalent in a given season's CSV (defensive contribution stats, pre-2025-26): write `null`, as before.

## Task 2: `pipeline/sync_current_season.py` (revise existing)

- Same trigger (scheduled cron, also serves as the Supabase keep-alive ping).
- Implement the double-gameweek-aware fetch logic described above, in place of a straight loop over `/api/event/{gw}/live/`.
- Upsert into `raw_gameweek_stats` on `(player_id, season, fixture)`.
- Continue upserting `fpl.players` from `bootstrap-static`'s `elements` array (current team/position — correct source for the *current* dimension table, as opposed to historical fixture rows).

## Task 3: `pipeline/sync_odds.py` (new)

- Scheduled alongside the other sync script (weekly cadence is enough — odds firm up close to kickoff, no need to poll more often for a weekly decision cycle).
- Use The Odds API (`ODDS_API_KEY` — add as a GitHub Actions secret alongside the existing Supabase ones). Pull the `h2h` (match winner) and `totals` (over/under goals) markets for upcoming EPL fixtures.
- Normalize the three `h2h` outcome prices to true probabilities (raw `1/decimal_odds` sums to more than 1 because of the bookmaker's margin — divide each by that sum before storing).
- Derive `implied_total_goals` from the `totals` line by inverting the over/under probability against a Poisson assumption for total match goals. (Match-level total goals is one of the few things in football that's genuinely well-approximated by Poisson — unlike individual player fantasy points, which is why we avoided that assumption elsewhere.)
- **Team-name matching risk**: the odds API's team names won't necessarily match the FPL API's naming exactly (capitalization, abbreviation, etc. can differ). Don't assume exact string equality — print both APIs' team-name sets during development and reconcile by hand if needed; there are only 20 clubs, a small static mapping table is fine.
- Upsert into `fpl.fixture_odds` on `(season, gw, team_h, team_a)`.

## Task 4: `pipeline/backfill_historical_odds.py` (new)

The Odds API only returns current/upcoming odds — there's no way to get historical odds from it for the seasons being backfilled in Task 1. Without this script, `fpl.fixture_odds` would be null for effectively the entire historical training set and only start filling in from whenever `sync_odds.py` starts running, which defeats the purpose of adding odds as a feature.

- One-time / manually triggered, same as Task 1. **Must run after Task 1** — it depends on `raw_gameweek_stats` already being populated.
- Source: `https://www.football-data.co.uk/mmz4281/{season_code}/E0.csv` for the same three seasons as the historical player backfill (season codes: `2324`, `2425`, `2526`). Inspect the actual CSV header before writing any column-mapping code — don't assume column names from memory.
- For each match row: resolve `gw` by looking up `(season, team, opponent_team, was_home)` in the already-backfilled `fpl.raw_gameweek_stats` (matching on the home team, from the home side's perspective) — don't match on date, fixture rescheduling makes that unreliable.
- Normalize team names against FPL's naming convention (see the note above — this is a separate mapping from the one needed for `sync_odds.py`, potentially with different spellings).
- Convert whichever bookmaker's odds columns are present (prefer a market-average column if the file has one, otherwise pick one bookmaker consistently) into normalized win/draw/loss probabilities and an implied-total-goals figure, using the same normalization/Poisson-inversion approach as `sync_odds.py`.
- Upsert into `fpl.fixture_odds` on `(season, gw, team_h, team_a)` — same table `sync_odds.py` writes to, this just backfills the seasons it can't reach.

## Out of scope

Same boundary as before: `fpl.features`, `fpl.predictions`, model training, and the decision layer are separate, later work. This handoff ends when `raw_gameweek_stats`, `players`, and `fixture_odds` are reliably populated and kept in sync.
