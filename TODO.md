# Project TODO List

## High Priority
- [X] Add latest data
- [X] Add highest-gw winner into both prize money, and season overview
- [X] Fix wigh.nu domain
- [ ] Write script for updating data for next season
- [ ] Admin page
- [ ] **FPL player-id bug (data corruption, affects all historical seasons):** FPL's
  `id`/`element` field is reassigned almost completely between seasons -- it is NOT a stable
  player identifier (same issue the schema already documents for team ids). Measured
  2025-26 -> 2026-27: of 841 ids, only 5 still refer to the same person, 648 now point to a
  different player, 188 no longer exist. Confirmed example: element id 1 is Folarin Balogun
  in 2023-24, Fábio Vieira in 2024-25, David Raya in 2025-26 and 2026-27.
  `backfill_historical.py` stores each season's own locally-scoped `element` as
  `fpl.raw_gameweek_stats.player_id`, so up to three unrelated real people are stacked under
  the same `player_id` across the three historical seasons; `fpl.players` only reflects
  whichever backfill/sync ran most recently. This also silently breaks `compute_features.py`'s
  cross-season rolling-form carryover, which groups by `player_id` across seasons expecting a
  stable identity.
  Fix: FPL's `code` field (in each season's `players_raw.csv` and in the live
  `bootstrap-static` response) IS stable per person -- confirmed matching for Raya
  (`code=154561`) across all four seasons. Repoint `sync_current_season.py` and
  `backfill_historical.py` to write `code` (not `element`/`id`) as `player_id` everywhere
  (resolve `element_id -> code` via that season's own bootstrap/`players_raw.csv`; the
  live element-summary API for double-gameweeks still needs the season's `element` id
  for the request itself, just don't persist it). No schema/FK change needed --
  `fpl.players.id` stays a bigint PK, just store `code` values in it. No change needed in
  `backfill_features.py`/`compute_features.py` -- they'll be correct automatically once the
  tables they read are keyed correctly. Requires truncating and rebuilding `fpl.players`,
  `fpl.raw_gameweek_stats`, and `fpl.features` from scratch once fixed (`fixture_odds` is
  unaffected -- keyed by team names, not players).

## Medium Priority
- [X] Show opponent on the bar graph for each gw
- [X] Luck-factor
- [ ] Add home-page with projects overlook
- [ ] Improve for mobile (smaller text)

## Low Priority
- [ ] Bigger charts and tables for desktop
- [ ] 


## Notes
- FPL feature pipeline: long-horizon predict-rows (high `gameweeks_ahead`) have a missingness
  pattern (odds and `chance_of_playing` both null) that never occurs in training data --
  uncertainty calibration there is extrapolated, not learned. Needs investigation once
  `PREDICTION_HORIZON_GAMEWEEKS` grows or model training starts.