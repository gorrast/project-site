import logging
import sys

import pandas as pd

from supabase_client import admin_client, upsert_in_batches

SEASONS = ["2023-24", "2024-25", "2025-26"]

# player_id/season/gw/fixture are the row key, handled separately in build_stat_rows.
STAT_COLUMNS = [
    "team",
    "position",
    "opponent_team",
    "was_home",
    "total_points",
    "minutes",
    "starts",
    "goals_scored",
    "assists",
    "clean_sheets",
    "bonus",
    "saves",
    "expected_goals",
    "expected_assists",
    "expected_goal_involvements",
    "expected_goals_conceded",
    "ict_index",
    "bps",
    "clearances_blocks_interceptions",
    "defensive_contribution",
    "recoveries",
    "tackles",
]

BOOL_COLUMNS = {"starts", "clean_sheets"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("backfill_historical")


def clean_value(v):
    if pd.isna(v):
        return None
    if hasattr(v, "item"):
        # Cast numpy scalar types (bool_/int64/float64) to native Python types
        # so the value is JSON-serializable for the Supabase client.
        return v.item()
    return v


def to_bool(v):
    cleaned = clean_value(v)
    return None if cleaned is None else bool(int(cleaned))


def fetch_season_df(season: str) -> pd.DataFrame:
    url = f"https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/{season}/gws/merged_gw.csv"
    try:
        return pd.read_csv(url, encoding="utf-8-sig")
    except Exception as e:
        log.error("Failed to fetch/parse merged_gw.csv for season %s: %s", season, e)
        sys.exit(1)


def fetch_teams_map(season: str) -> dict[int, str]:
    """id -> team name for the given season. FPL's numeric team ids are reassigned
    each season, so opponent_team (an id in the source CSV) can only be resolved
    to text against this season's own mapping."""
    url = f"https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/{season}/teams.csv"
    try:
        teams_df = pd.read_csv(url, encoding="utf-8-sig")
    except Exception as e:
        log.error("Failed to fetch/parse teams.csv for season %s: %s", season, e)
        sys.exit(1)
    return dict(zip(teams_df["id"], teams_df["name"]))


def build_player_rows(df: pd.DataFrame) -> list[dict]:
    players: dict[int, dict] = {}
    for _, row in df.iterrows():
        player_id = int(row["element"])
        players[player_id] = {
            "id": player_id,
            "name": clean_value(row.get("name")),
            "current_team": clean_value(row.get("team")),
            "current_position": clean_value(row.get("position")),
        }
    return list(players.values())


def build_stat_rows(df: pd.DataFrame, season: str, teams_map: dict[int, str]) -> list[dict]:
    # Each CSV row already represents one fixture (the `fixture` column), so this
    # is a direct per-row mapping onto the (player_id, season, fixture) grain --
    # no aggregation needed. The source file occasionally contains exact
    # duplicate rows for the same (element, fixture) (confirmed upstream data
    # quirk, not a double-gameweek split) -- drop those before upserting or
    # Postgres rejects the batch ("ON CONFLICT DO UPDATE command cannot affect
    # row a second time").
    df = df.drop_duplicates(subset=["element", "fixture"], keep="first")

    rows = []
    for _, row in df.iterrows():
        stat_row = {
            "player_id": int(row["element"]),
            "season": season,
            "gw": int(row["GW"]),
            "fixture": int(row["fixture"]),
        }
        for col in STAT_COLUMNS:
            if col not in df.columns:
                stat_row[col] = None
            elif col == "opponent_team":
                team_id = clean_value(row[col])
                stat_row[col] = None if team_id is None else teams_map.get(int(team_id))
            elif col in BOOL_COLUMNS:
                stat_row[col] = to_bool(row[col])
            else:
                stat_row[col] = clean_value(row[col])
        rows.append(stat_row)
    return rows


def process_season(season: str) -> int:
    df = fetch_season_df(season)
    teams_map = fetch_teams_map(season)

    player_rows = build_player_rows(df)
    upsert_in_batches(admin_client(), "players", player_rows)

    stat_rows = build_stat_rows(df, season, teams_map)
    upsert_in_batches(admin_client(), "raw_gameweek_stats", stat_rows)

    return len(stat_rows)


if __name__ == "__main__":
    log.info("Starting historical backfill for seasons: %s", ", ".join(SEASONS))

    for season in SEASONS:
        row_count = process_season(season)
        log.info("Season %s: upserted %d fixture-stat rows", season, row_count)

    log.info("Historical backfill complete")
