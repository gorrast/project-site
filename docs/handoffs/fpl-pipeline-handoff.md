# Handoff: FPL Data Ingestion Pipeline

## Context

This is the first slice of a larger FPL points-prediction project (see project background below if useful, but the two scripts specified here are the entire scope of this handoff — do not build feature engineering, model training, or the decision layer yet).

- **Storage**: Supabase Postgres, schema `fpl` (already created — see schema below, do not modify it as part of this task).
- **Auth**: writes use the `service_role` key (bypasses RLS/grants). Read the URL and key from environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; in GitHub Actions these come from repo secrets of the same names.
- **Language**: Python. Use `supabase-py` for writes and `requests`/`pandas` for fetching.
- **Location**: new `/pipeline` directory in this repo, alongside the existing Next.js app. Don't touch the Next.js code.

## Existing schema (already applied — for reference only)

```sql
fpl.players (id bigint pk, name text, position text, team text)

fpl.raw_gameweek_stats (
  player_id bigint references fpl.players(id),
  season text, gw int,
  total_points int, minutes int, starts int, was_home boolean, opponent_team int,
  expected_goals numeric, expected_assists numeric, expected_goal_involvements numeric,
  expected_goals_conceded numeric, ict_index numeric, bps int,
  clearances_blocks_interceptions int, defensive_contribution int, recoveries int, tackles int,
  primary key (player_id, season, gw)
)
```

## Known gotchas (confirmed against real data, not assumptions)

1. **Schema drift across seasons.** The historical archive's per-season CSVs don't all have the same columns. Seasons before ~2025-26 lack `clearances_blocks_interceptions`, `defensive_contribution`, `recoveries`, `tackles` (FPL's defensive-contribution scoring didn't exist yet). Any column absent in a given season's source file must be written as `null`, not cause a failure or get silently dropped from the whole row.
2. **Player identity comes from the row itself, not a separate lookup.** Both the historical CSVs and the live API give `name`/`position`/`team` alongside the stats. Upsert into `fpl.players` from whatever row you're already processing, in both scripts. Do NOT assume `fpl.players` is pre-populated from a single source — a strict foreign-key failure will occur for players from older seasons who've since left the league, if you only populate `players` from the current season's `bootstrap-static`.
3. **Recent gameweeks can be revised** (bonus points confirmed ~1hr after, occasional stat corrections for a few days after). This is why the current-season script re-syncs and upserts every played gameweek on every run, rather than only fetching "new" data.

---

## Task 1: `pipeline/backfill_historical.py`

**Trigger**: manual only (`workflow_dispatch` in Actions, or run locally). Not part of the recurring schedule — historical seasons are finished and don't change.

**Behavior**:
- Define a constant list of season strings to backfill, e.g. `["2023-24", "2024-25", "2025-26"]`.
- For each season, load `https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/{season}/gws/merged_gw.csv` (pandas is fine for this).
- For each row: upsert into `fpl.players` (id from `element`, name, position, team), then upsert into `fpl.raw_gameweek_stats` (season, gw from the `GW` column, and the stat columns listed in the schema above — `null` for any column missing from that season's file).
- Insert-only semantics are fine here (use upsert anyway for safe re-runs, but no need to handle mid-season revision logic — these seasons are final).
- Log a row count per season on completion so a bad fetch is obvious.

## Task 2: `pipeline/sync_current_season.py`

**Trigger**: GitHub Actions scheduled cron (this also serves as the Supabase keep-alive ping, so make sure it runs at least every few days regardless of matchday).

**Behavior**:
- Define the current season as a simple config constant (e.g. `CURRENT_SEASON = "2026-27"`) — update this once per year rather than deriving it, to keep the logic simple.
- Fetch `https://fantasy.premierleague.com/api/bootstrap-static/` — use its `events` array to determine which gameweeks are finished/`data_checked` so far this season, and upsert `fpl.players` from its `elements` array.
- For every finished gameweek so far this season, fetch `https://fantasy.premierleague.com/api/event/{gw}/live/` (this returns all players' stats for that single gameweek in one call — do not use the per-player `element-summary` endpoint, it's much more expensive for the same data).
- Upsert every player's row into `fpl.raw_gameweek_stats` for `(player_id, CURRENT_SEASON, gw)`. Re-writing an unchanged row is fine and expected — this is what handles the mid-week stat corrections mentioned above.

## Out of scope for this handoff

Feature engineering, model training, and the decision layer are separate, later work and should not be started here. This handoff ends when `fpl.raw_gameweek_stats` and `fpl.players` are reliably populated and kept in sync.
