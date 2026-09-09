import logging
import random
import sys

import lightgbm as lgb
import numpy as np
import pandas as pd

from config import (
    BASELINE_WINDOW_GAMEWEEKS,
    CURRENT_SEASON,
    DEFAULT_SEASON_WEIGHT,
    HYPERPARAM_SEARCH_RANGES,
    N_RANDOM_SEARCH_TRIALS,
    SEASON_SAMPLE_WEIGHTS,
    VALIDATION_WINDOW_GAMEWEEKS,
)
from supabase_client import admin_client, fetch_all_rows, upsert_in_batches

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("train_and_predict")

EXCLUDED_COLUMNS = {"player_id", "season", "gw", "fixture", "target_points"}
CATEGORICAL_FEATURES = ["position", "opponent_team"]


def load_and_prepare(client) -> pd.DataFrame:
    """Fetch the whole fpl.features table and cast text feature columns to
    pandas category dtype on the COMBINED table (train+predict rows together),
    so category codes are identical between what the model is fit on and what
    it later predicts on. postgrest serializes Postgres `numeric` columns as
    JSON strings (to avoid float-precision loss), and a column that's all-None
    in the response stays `object` dtype -- both need coercing to numeric or
    LightGBM rejects them outright."""
    rows = fetch_all_rows(client, "features")
    df = pd.DataFrame(rows)
    non_numeric = set(CATEGORICAL_FEATURES) | {"season"}
    for col in df.columns:
        if col in non_numeric:
            continue
        if df[col].dtype == "object" or df[col].dtype == "bool":
            df[col] = pd.to_numeric(df[col], errors="coerce")
    for col in CATEGORICAL_FEATURES:
        df[col] = df[col].astype("category")
    return df


def split_played_predict(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    played = df[df["target_points"].notna()].copy()
    predict = df[df["target_points"].isna()].copy()
    return played, predict


def most_recent_complete_season(played: pd.DataFrame) -> str | None:
    """Plain lexicographic max over seasons other than CURRENT_SEASON -- the
    zero-padded YYYY-YY format sorts correctly as a string, so this self-updates
    as seasons roll forward rather than needing a hardcoded season name."""
    candidates = sorted(s for s in played["season"].unique() if s != CURRENT_SEASON)
    return candidates[-1] if candidates else None


def determine_validation_window(played: pd.DataFrame) -> tuple[str | None, list[int]]:
    """held_out_gws = last_n_played_gameweeks(n=VALIDATION_WINDOW_GAMEWEEKS,
    prefer=CURRENT_SEASON, fallback=most_recent_complete_season)."""
    current_gws = sorted(played.loc[played["season"] == CURRENT_SEASON, "gw"].unique())
    if len(current_gws) >= VALIDATION_WINDOW_GAMEWEEKS:
        val_season = CURRENT_SEASON
    else:
        val_season = most_recent_complete_season(played)

    if val_season is None:
        return None, []

    val_gws = sorted(played.loc[played["season"] == val_season, "gw"].unique())[-VALIDATION_WINDOW_GAMEWEEKS:]
    return val_season, val_gws


def split_train_validation(
    played: pd.DataFrame, val_season: str, val_gws: list[int]
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Validation is the held-out window; train is the plain COMPLEMENT (not a
    chronological "everything before" cutoff) -- this is what keeps CURRENT_SEASON's
    played rows in training even though they're chronologically after a prior
    season's validation window."""
    val_mask = (played["season"] == val_season) & (played["gw"].isin(val_gws))
    val_df = played[val_mask].copy()
    train_df = played[~val_mask].copy()
    return train_df, val_df


def compute_sample_weights(train_df: pd.DataFrame) -> pd.Series:
    return train_df["season"].map(SEASON_SAMPLE_WEIGHTS).fillna(DEFAULT_SEASON_WEIGHT)


def compute_gameweek_baseline(played: pd.DataFrame) -> pd.DataFrame:
    """Naive baseline: a true GAMEWEEK-windowed (not fixture-windowed) moving
    average of past points. Distinct from the existing form_points_3/5 feature
    columns, which are fixture-windowed and would double-count on double-gameweeks.
    Sums target_points per (player, season, gw) to collapse double-gameweeks into
    one gameweek total, then shifts before rolling for leakage-safety -- same
    technique as feature_utils.add_shifted_form_features, grouped by player_id
    alone so the window can span a season boundary."""
    gw_points = (
        played.groupby(["player_id", "season", "gw"], as_index=False)["target_points"]
        .sum()
        .sort_values(["player_id", "season", "gw"])
    )
    gw_points["baseline_points"] = gw_points.groupby("player_id")["target_points"].transform(
        lambda s: s.shift(1).rolling(BASELINE_WINDOW_GAMEWEEKS, min_periods=1).mean()
    )
    return gw_points[["player_id", "season", "gw", "baseline_points"]]


def join_baseline_onto_validation(val_df: pd.DataFrame, gw_baseline: pd.DataFrame, train_df: pd.DataFrame) -> pd.Series:
    merged = val_df.merge(gw_baseline, on=["player_id", "season", "gw"], how="left")
    fallback = train_df["target_points"].mean()
    return merged["baseline_points"].fillna(fallback)


def rmse(y_true, y_pred) -> float:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def build_feature_matrix(df: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
    return df[feature_cols]


def sample_hyperparameters() -> dict:
    ranges = HYPERPARAM_SEARCH_RANGES
    return {
        "num_leaves": random.randint(*ranges["num_leaves"]),
        "learning_rate": random.uniform(*ranges["learning_rate"]),
        "min_child_samples": random.randint(*ranges["min_child_samples"]),
        "feature_fraction": random.uniform(*ranges["feature_fraction"]),
    }


def fit_one_trial(params: dict, X_train, y_train, w_train, X_val, y_val) -> tuple[lgb.LGBMRegressor, float]:
    model = lgb.LGBMRegressor(
        objective="regression",
        n_estimators=1000,
        num_leaves=params["num_leaves"],
        learning_rate=params["learning_rate"],
        min_child_samples=params["min_child_samples"],
        feature_fraction=params["feature_fraction"],
        verbosity=-1,
    )
    model.fit(
        X_train,
        y_train,
        sample_weight=w_train,
        eval_set=[(X_val, y_val)],
        eval_metric="rmse",
        categorical_feature=CATEGORICAL_FEATURES,
        callbacks=[lgb.early_stopping(stopping_rounds=50, verbose=False)],
    )
    val_pred = model.predict(X_val)
    return model, rmse(y_val, val_pred)


def run_random_search(X_train, y_train, w_train, X_val, y_val) -> tuple[dict, lgb.LGBMRegressor, float]:
    """Winning params/model are this search's OUTPUT, not persisted anywhere --
    determined fresh each run, per the handoff. No fixed random seed."""
    best_params = None
    best_model = None
    best_rmse = float("inf")

    for trial in range(1, N_RANDOM_SEARCH_TRIALS + 1):
        params = sample_hyperparameters()
        model, val_rmse = fit_one_trial(params, X_train, y_train, w_train, X_val, y_val)
        log.info("Trial %d/%d: params=%s val_rmse=%.4f", trial, N_RANDOM_SEARCH_TRIALS, params, val_rmse)
        if val_rmse < best_rmse:
            best_params, best_model, best_rmse = params, model, val_rmse

    return best_params, best_model, best_rmse


def log_feature_importance(model: lgb.LGBMRegressor) -> None:
    importances = sorted(zip(model.feature_name_, model.feature_importances_), key=lambda t: -t[1])
    log.info("Feature importances (gain-based split counts):")
    for name, score in importances:
        log.info("  %-32s %d", name, score)


def build_prediction_payload(model: lgb.LGBMRegressor, predict_df: pd.DataFrame, feature_cols: list[str]) -> list[dict]:
    X_predict = build_feature_matrix(predict_df, feature_cols)
    preds = model.predict(X_predict)
    rows = []
    for (_, row), xpts in zip(predict_df.iterrows(), preds):
        rows.append(
            {
                "player_id": int(row["player_id"]),
                "season": row["season"],
                "gw": int(row["gw"]),
                "fixture": int(row["fixture"]),
                "xpts_mean": float(xpts),
                "xpts_p10": None,
                "xpts_p50": None,
                "xpts_p90": None,
            }
        )
    return rows


if __name__ == "__main__":
    log.info("Starting train_and_predict")
    client = admin_client()

    df = load_and_prepare(client)
    log.info("Loaded %d rows from fpl.features", len(df))

    played_df, predict_df = split_played_predict(df)
    log.info("Split: %d played rows, %d predict rows", len(played_df), len(predict_df))

    if played_df.empty:
        log.info("No played rows with known target_points -- nothing to train on, exiting")
        raise SystemExit(0)

    val_season, val_gws = determine_validation_window(played_df)
    log.info("Validation window: season=%s gws=%s", val_season, val_gws)
    if not val_gws:
        log.info("No played gameweeks available for a validation window -- exiting")
        raise SystemExit(0)

    train_df, val_df = split_train_validation(played_df, val_season, val_gws)
    log.info("Train rows: %d, validation rows: %d", len(train_df), len(val_df))
    if train_df.empty or val_df.empty:
        log.info("Train or validation split is empty -- exiting without training")
        raise SystemExit(0)

    sample_weights = compute_sample_weights(train_df)

    gw_baseline = compute_gameweek_baseline(played_df)
    baseline_pred = join_baseline_onto_validation(val_df, gw_baseline, train_df)
    baseline_rmse = rmse(val_df["target_points"], baseline_pred)
    log.info("Naive %d-gameweek baseline RMSE: %.4f", BASELINE_WINDOW_GAMEWEEKS, baseline_rmse)

    feature_cols = [c for c in df.columns if c not in EXCLUDED_COLUMNS]
    X_train = build_feature_matrix(train_df, feature_cols)
    y_train = train_df["target_points"]
    X_val = build_feature_matrix(val_df, feature_cols)
    y_val = val_df["target_points"]

    best_params, best_model, best_val_rmse = run_random_search(X_train, y_train, sample_weights, X_val, y_val)
    improvement = (baseline_rmse - best_val_rmse) / baseline_rmse * 100
    log.info("Best params: %s", best_params)
    log.info(
        "Model RMSE: %.4f vs baseline RMSE: %.4f -- beats naive baseline by %.1f%%",
        best_val_rmse,
        baseline_rmse,
        improvement,
    )

    log_feature_importance(best_model)

    if predict_df.empty:
        log.info("No predict-rows (target_points is null) this run -- nothing to upsert")
    else:
        predict_rows = build_prediction_payload(best_model, predict_df, feature_cols)
        upsert_in_batches(client, "predictions", predict_rows)
        log.info("Upserted %d prediction rows into fpl.predictions", len(predict_rows))

    log.info("train_and_predict complete")
