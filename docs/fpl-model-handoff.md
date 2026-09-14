# Handoff: Baseline Model — Train and Predict

## Context

Depends on `fpl.features` being populated (done). Trains a model predicting `target_points` and writes `xpts_mean` into `fpl.predictions` for every predict-row. Attach `fpl-schema.sql` and the existing `/pipeline` directory; plan mode as usual.

## Scope: point estimate only, quantile regression is a fast-follow, not a blocker

This pass ships `xpts_mean` only — that's what the decision layer's optimizer actually needs, and getting the full train → predict → serve loop working sooner matters more than shipping the distributional version first. Leave `xpts_p10`/`xpts_p50`/`xpts_p90` `null`. Quantile regression is mostly a change to the training objective, not a new architecture — genuinely a near-term follow-up once this is proven, not deferred indefinitely.

## Task: `pipeline/train_and_predict.py` (new)

Runs as a new step in the **same** consolidated GitHub Actions workflow, after `compute_features.py` (`sync_current_season.py` → `sync_odds.py` → `compute_features.py` → `train_and_predict.py`), so it always trains against freshly computed features. Retrains from scratch every run — no model persistence between runs needed at this data scale; matches the original project design intent of retraining each gameweek to track concept drift, and full retraining is cheap enough here not to bother with incremental updates.

**Training data**: filter `fpl.features` to `where target_points is not null` (equivalently `gameweeks_ahead = 0`) — the only rows with known outcomes. Exclude `player_id`, `season`, `gw`, `fixture`, and `target_points` itself from the feature matrix; every other column is a legitimate input, including `gameweeks_ahead` (see above).

**Sample weighting — downweight older seasons.** These are your choices about how much to trust each season, not algorithm output — put them in `config.py`:

```python
SEASON_SAMPLE_WEIGHTS = {
    "2023-24": 0.5,
    "2024-25": 0.75,
    "2025-26": 1.0,
    "2026-27": 1.0,
}
DEFAULT_SEASON_WEIGHT = 1.0  # fallback if a new season starts before this dict is updated
```

Discrete tiers, not a continuous decay formula — with this few seasons of history a fancier curve wouldn't buy anything real, and tiers are easier to reason about, explain, and adjust by hand each year alongside `CURRENT_SEASON`.

**Train/validation split — chronological, not random.** Random k-fold is wrong here: rolling-form features summarize a player's recent past, so a random split can put a player's GW10 in training and GW9 in validation, which doesn't reflect how the model is actually used and inflates apparent performance.

The validation window should track the most recent available data, not be pinned to a specific season — otherwise it permanently sacrifices whichever season happens to be freshest at the time this was written, which fights directly against the recency-weighting decision above.

- **Validate on**: the most recent `VALIDATION_WINDOW_GAMEWEEKS` played gameweeks available — add this as a new constant in the existing `config.py` (alongside `PREDICTION_HORIZON_GAMEWEEKS`), default `8`, so it's adjustable without touching script logic. Use `2026-27`'s own tail once it has at least `VALIDATION_WINDOW_GAMEWEEKS` played gameweeks; until then (early in the season, as now), fall back to `2025-26`'s tail. This is a small conditional, not two different code paths — `held_out_gws = last_n_played_gameweeks(n=VALIDATION_WINDOW_GAMEWEEKS, prefer=current_season, fallback=most_recent_complete_season)`.
- **Train on**: everything chronologically before the validation window — i.e. once the switchover happens, all of 2025-26 moves into training in full, recovering the data this design shouldn't have permanently excluded.
- **2026-27's played gameweeks are otherwise still used in training** (weighted 1.0) even before the switchover — only its most recent `VALIDATION_WINDOW_GAMEWEEKS` (once it has that many) get carved out for validation specifically.

Note this means the validation set's composition changes partway through the season (from 2025-26's tail to 2026-27's own tail) — that's intentional self-correction, not a bug, and worth remembering if the reported validation RMSE shifts noticeably around that point; it reflects a different, fresher evaluation set, not a regression.

Also worth knowing going in: since the light random search also selects hyperparameters against this same holdout, the reported "beats baseline by X%" number is mildly optimistic — real performance is what the live evaluation loop shows once it's running, not this offline number alone.

**Baseline to beat**: compute the naive baseline (`BASELINE_WINDOW_GAMEWEEKS`-gameweek moving average of past points, config.py, default `3`) on the same validation set, and report the trained model's RMSE against it explicitly in the run's logs — "beats naive baseline by X%" is the number that actually matters, not an isolated error figure.

**Model and objective**: LightGBM regressor, `position` as a native categorical feature (not one-hot). Objective and eval metric are RMSE (LightGBM's default `regression`/L2 objective already does this — no custom objective needed, just make sure the reported metric is RMSE, not MAE or the library default's label). This deliberately weights big misses (haul games) more heavily than small ones across the bulk of ordinary weeks — the right trade for a fantasy context, where missing a haul costs more than being half a point off on a bench-fringe player.

**Hyperparameter tuning — light random search, inside this same run.** Sample `N_RANDOM_SEARCH_TRIALS` random combinations (config.py, default `30`) from bounded ranges over `num_leaves`, `learning_rate`, `min_child_samples`, and `feature_fraction` — also config.py constants, not inline literals, since these are search-space decisions made by you, not values the algorithm itself picks:

```python
N_RANDOM_SEARCH_TRIALS = 30
HYPERPARAM_SEARCH_RANGES = {
    "num_leaves": (15, 63),
    "learning_rate": (0.01, 0.2),
    "min_child_samples": (5, 50),
    "feature_fraction": (0.6, 1.0),
}
```

Score each sampled combination against the chronological validation set, keep the best. The *winning* combination itself is the search's output, not a config value — it's determined fresh each run and shouldn't be hardcoded anywhere. This stays cheap enough (LightGBM fits are fast at this data volume) to just rerun as part of the same weekly retrain — no separate tuning job, no persisted "chosen hyperparameters" artifact to manage.

**Log feature importances** (to the GitHub Actions run log is sufficient, no need for separate storage) after each training run. This directly serves two open TODO items — checking whether `fixtures_this_gw` and `defensive_contribution` are actually earning their keep — by giving a concrete, recurring signal to look at rather than a one-off manual check.

**Writing predictions**: for every row in `fpl.features` where `target_points is null` (the predict-rows, `gameweeks_ahead` 1 through `PREDICTION_HORIZON_GAMEWEEKS`), run the trained model and upsert the result into `fpl.predictions.xpts_mean` on `(player_id, season, fixture)`. Leave the quantile columns `null`.

## Out of scope

Quantile regression, the Bayesian phase, and the decision layer (starting-XI optimizer, waiver recommender) are separate, later work. This handoff ends when `fpl.predictions.xpts_mean` is reliably populated and beats the naive baseline's RMSE on the validation set.
