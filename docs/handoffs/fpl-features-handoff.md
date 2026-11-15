# Handoff: FPL Feature Engineering Pipeline

## Context

Depends on `raw_gameweek_stats`, `players`, and `fixture_odds` already being populated (the four ingestion tasks from the earlier handoff — done). Populates `fpl.features` — the single computation surface used for both training and serving (see the schema comments on that table). Attach `fpl-schema.sql` and the existing `/pipeline` directory; plan mode as usual before letting anything get written.

Two scripts, same historical/recurring split as the ingestion pipeline:

- `pipeline/backfill_features.py` — one-time, `workflow_dispatch` only.
- `pipeline/compute_features.py` — recurring. **Must run as a step after `sync_current_season.py` and `sync_odds.py` in the same scheduled workflow**, not as its own independently-triggered workflow — see Scheduling.

## Core rule: no leakage

Every rolling-form feature for a given fixture must only use that player's **strictly earlier** fixtures. Sort each player's `raw_gameweek_stats` rows by `(season, gw, fixture)`, then compute rolling features by shifting one position before applying the rolling window (e.g. pandas' `groupby('player_id')[col].transform(lambda s: s.shift(1).rolling(5, min_periods=1).mean())`) — the window looks backward from the fixture immediately before the one being featurized, never including it. Getting the shift direction wrong is the single easiest way to quietly leak the target into the features: the backtest looks great, the live predictions don't.

A player's first fixture in the dataset has zero prior fixtures — that row's rolling-form columns should be `null`, not zero and not an imputed league average.

## Task 1: `pipeline/backfill_features.py` (new)

- One-time, `workflow_dispatch`, run after the ingestion pipeline's backfill tasks (needs `raw_gameweek_stats` and `fixture_odds` fully populated first — already true).
- For every row in `raw_gameweek_stats` across the backfilled historical seasons: compute the shifted rolling-window features above, join to `fixture_odds` for the odds-derived columns (see orientation note below), set `target_points = total_points` (known, since these are already-played fixtures), and set `gameweeks_ahead = 0` (these are all facts, not forward predictions). Leave `chance_of_playing` null — it's a live-only value with no historical record.
- Insert into `fpl.features` on `(player_id, season, fixture)`.

## Task 2: `pipeline/compute_features.py` (new)

Two things, in this order, every run.

### a) Update this season's already-played fixtures

For every row now in `raw_gameweek_stats` for the current season, recompute the shifted rolling-window features (they legitimately change week to week as history accumulates) and upsert into `fpl.features`, filling `target_points` from `total_points` and setting `gameweeks_ahead = 0`. This is a plain overwrite for `gameweeks_ahead` — a row that was written last week as `gameweeks_ahead = 1` (a prediction) needs to become `0` now that the fixture's actually been played.

`chance_of_playing` gets the opposite treatment — **never overwrite it here**:

```sql
on conflict (player_id, season, fixture) do update set
  form_points_5 = excluded.form_points_5,
  -- ...other recomputable columns...
  target_points = excluded.target_points,
  gameweeks_ahead = excluded.gameweeks_ahead,
  chance_of_playing = coalesce(fpl.features.chance_of_playing, excluded.chance_of_playing)
```

`chance_of_playing` is a snapshot of what was known when the fixture was still upcoming; a fresh lookup for an already-played fixture doesn't mean the same thing and would silently corrupt what the model actually saw at prediction time.

### b) Generate the predict-rows: next `PREDICTION_HORIZON_GAMEWEEKS` gameweeks

There's no `raw_gameweek_stats` row to mirror for fixtures that haven't been played — construct these instead. Loop over `gameweeks_ahead` from `1` to a `PREDICTION_HORIZON_GAMEWEEKS` constant (start at `5`) — a plain loop, not per-offset special-cased logic, since this constant is expected to grow substantially later (see below). For each offset:

- Resolve the target gameweek's fixture(s) for each player's *current* team (from `fpl.players`, since there's no per-fixture team value yet — it hasn't happened) via the fixtures list. A double gameweek at this offset produces two predict-rows, both tagged with the same `gameweeks_ahead` value, differentiated by `fixture` as usual.
- Compute the same shifted rolling-window features over *past* (already-played) fixtures only — identical logic regardless of how far out the offset is.
- Join to `fixture_odds` for the odds-derived columns, but don't assume it succeeds — if the odds API doesn't have lines that far out, the row just gets `null` odds columns. Don't hardcode an assumed cutoff distance; let actual data availability decide this at run time.
- `chance_of_playing`: only take a live snapshot from `bootstrap-static`'s `chance_of_playing_next_round` when `gameweeks_ahead = 1`. Leave it `null` for every other offset — FPL's own field only ever estimates the next round, and fabricating a decayed/carried-forward value for further-out weeks would manufacture false confidence exactly where recovery timelines are least predictable.
- Set `target_points = null`. These are the rows the trained model actually predicts on.

**Leakage safeguard — gate on kickoff time, not on the gameweek's `finished` flag.** `bootstrap-static` marks a gameweek "finished" only once *every* fixture in it is complete, so a partially-played gameweek (some matches already kicked off, others not) can still look "upcoming" as a whole — mainly a risk at `gameweeks_ahead = 1`, since offsets 2 and beyond haven't started by construction. If the script naively treats the next unfinished gameweek as ready to snapshot, it risks capturing `chance_of_playing` *after* a player's status changed during an already-played match in that same gameweek — real leakage, since the feature would reflect information that only existed because part of the event it's describing had already happened.

Fix: filter on each individual fixture's `kickoff_time` (already present in the `/api/fixtures/` response pulled for opponent/`was_home` — no extra API cost) against the current timestamp at run time, everywhere in this step, not on the gameweek-level `finished` flag. Implement as one reusable function (e.g. `get_upcoming_fixtures(now)`) that both the fixture-resolution and the `chance_of_playing` snapshot call, rather than each re-deriving "what counts as upcoming" separately. If a fixture expected to be upcoming turns out to have already kicked off by the time the script runs, skip it and log a warning — fail loud, not silent.

**Why growing `PREDICTION_HORIZON_GAMEWEEKS` later should be cheap, and the one thing that won't be free.** Because predict-rows get fully recomputed every scheduled run rather than stored once, a far-out row's assumption about a player's current team is inherently provisional and gets corrected on subsequent runs as that gameweek approaches — normal behavior for any rolling forecast, no redesign needed. What *will* need attention later (tracked in TODO.md, not now): historical training rows never exhibit the same missingness combination a far-out predict-row does (training rows have odds populated and only `chance_of_playing` null; a `gameweeks_ahead = 5` row could have both null at once) — so the model's uncertainty calibration on long-horizon rows is extrapolated, not learned, until that's specifically investigated.

## Shared reference notes

**Orientation — `team_win_prob` is from the player's side, not literally "home".** `fixture_odds` stores `home_win_prob`/`away_win_prob` from the fixture's perspective; `features.team_win_prob` needs to be from the *player's team's* perspective:

- if `was_home = true`: `team_win_prob = home_win_prob`, `team_loss_prob = away_win_prob`
- if `was_home = false`: `team_win_prob = away_win_prob`, `team_loss_prob = home_win_prob`
- `team_draw_prob = draw_prob` either way

**`fixtures_this_gw`.** Played fixtures: count of `raw_gameweek_stats` rows sharing `(player_id, season, gw)`. Predict-rows: count of fixtures the player's *current* team has in that specific target gameweek, from the fixtures list.

## Scheduling

Consolidate `sync_current_season.py`, `sync_odds.py`, and `compute_features.py` into **one** GitHub Actions workflow with three sequential steps in that order, rather than three independently-scheduled workflows. `compute_features.py` depends on both of the others' output being fresh in the same run — separate cron schedules can't guarantee that ordering, and a race here means silently computing features off stale odds or last week's stats.

## Out of scope

Model training and the decision layer remain separate, later work. This handoff ends when `fpl.features` is reliably populated for both historical and current-season fixtures, with correctly null-target rows ready for each gameweek in the prediction horizon.
