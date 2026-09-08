import logging
import sys

import pandas as pd

from backfill_historical import SEASONS
from feature_utils import FORM_SPECS, add_shifted_form_features, build_odds_by_key, orient_team_odds
from supabase_client import admin_client, fetch_all_rows, upsert_in_batches

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("backfill_features")


def build_feature_rows(df: pd.DataFrame, odds_by_key: dict) -> list[dict]:
    df = add_shifted_form_features(df)
    df["fixtures_this_gw"] = df.groupby(["player_id", "season", "gw"])["fixture"].transform("size")

    rows = []
    for _, row in df.iterrows():
        odds = orient_team_odds(odds_by_key, row["season"], row["gw"], row["team"], row["opponent_team"], row["was_home"])
        form_values = {col: (None if pd.isna(row[col]) else float(row[col])) for col, _, _ in FORM_SPECS}
        rows.append(
            {
                "player_id": int(row["player_id"]),
                "season": row["season"],
                "gw": int(row["gw"]),
                "fixture": int(row["fixture"]),
                "position": row["position"],
                "fixtures_this_gw": int(row["fixtures_this_gw"]),
                "gameweeks_ahead": 0,
                "was_home": row["was_home"],
                "opponent_team": row["opponent_team"],
                **odds,
                **form_values,
                "chance_of_playing": None,
                "target_points": None if pd.isna(row["total_points"]) else int(row["total_points"]),
            }
        )
    return rows


if __name__ == "__main__":
    log.info("Starting feature backfill for seasons: %s", ", ".join(SEASONS))

    client = admin_client()

    odds_rows = fetch_all_rows(client, "fixture_odds")
    odds_by_key = build_odds_by_key(odds_rows)
    log.info("Loaded %d fixture_odds rows", len(odds_rows))

    total_rows = 0
    for season in SEASONS:
        stat_rows = fetch_all_rows(client, "raw_gameweek_stats", filters=[("season", season)])
        if not stat_rows:
            log.warning("No raw_gameweek_stats rows found for season %s -- skipping", season)
            continue

        df = pd.DataFrame(stat_rows)
        feature_rows = build_feature_rows(df, odds_by_key)
        upsert_in_batches(client, "features", feature_rows)
        total_rows += len(feature_rows)
        log.info("Season %s: upserted %d feature rows", season, len(feature_rows))

    log.info("Feature backfill complete: %d total rows across %d seasons", total_rows, len(SEASONS))
