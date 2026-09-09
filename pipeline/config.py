CURRENT_SEASON = "2026-27"
PREDICTION_HORIZON_GAMEWEEKS = 5

# --- train_and_predict.py ---

SEASON_SAMPLE_WEIGHTS = {
    "2023-24": 0.5,
    "2024-25": 0.75,
    "2025-26": 1.0,
    "2026-27": 1.0,
}
DEFAULT_SEASON_WEIGHT = 1.0  # fallback if a new season starts before this dict is updated

VALIDATION_WINDOW_GAMEWEEKS = 8
BASELINE_WINDOW_GAMEWEEKS = 3

N_RANDOM_SEARCH_TRIALS = 30
HYPERPARAM_SEARCH_RANGES = {
    "num_leaves": (15, 63),
    "learning_rate": (0.01, 0.2),
    "min_child_samples": (5, 50),
    "feature_fraction": (0.6, 1.0),
}
