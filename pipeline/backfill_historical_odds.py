import logging
import sys

import pandas as pd

from odds_utils import decimal_odds_to_prob, normalize_probs, poisson_implied_total_goals
from supabase_client import admin_client, upsert_in_batches

SEASON_CODES = {
    "2023-24": "2324",
    "2024-25": "2425",
    "2025-26": "2526",
}

TOTALS_LINE = 2.5

# Prefer the market-average columns; fall back to a single consistent
# bookmaker's columns for seasons/files where the averages aren't present.
H2H_COLUMNS_PREFERENCE = [("AvgH", "AvgD", "AvgA"), ("B365H", "B365D", "B365A")]
TOTALS_COLUMNS_PREFERENCE = [("Avg>2.5", "Avg<2.5"), ("B365>2.5", "B365<2.5")]

# football-data.co.uk team name -> FPL team name. Only names that actually
# differ need an entry; anything absent is assumed to already match. Unmapped
# names are logged loudly rather than silently dropped, per the handoff.
FOOTBALL_DATA_TEAM_MAP = {
    "Man United": "Man Utd",
    "Sheffield United": "Sheffield Utd",
    "Tottenham": "Spurs",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("backfill_historical_odds")


def map_team_name(name: str) -> str:
    return FOOTBALL_DATA_TEAM_MAP.get(name, name)


def fetch_match_df(season: str) -> pd.DataFrame:
    code = SEASON_CODES[season]
    url = f"https://www.football-data.co.uk/mmz4281/{code}/E0.csv"
    try:
        return pd.read_csv(url, encoding="utf-8-sig")
    except Exception as e:
        log.error("Failed to fetch/parse E0.csv for season %s: %s", season, e)
        sys.exit(1)


PAGE_SIZE = 1000


def fetch_gw_lookup(season: str) -> dict[tuple[str, str], int]:
    """(team, opponent_team) -> gw, resolved from the home side's perspective
    against the already-backfilled raw_gameweek_stats. Paginated -- a season
    has many more was_home=True rows (one per player per home fixture) than
    Supabase's default per-request row cap."""
    lookup: dict[tuple[str, str], int] = {}
    offset = 0
    while True:
        resp = (
            admin_client()
            .schema("fpl")
            .table("raw_gameweek_stats")
            .select("team,opponent_team,gw")
            .eq("season", season)
            .eq("was_home", True)
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        for row in resp.data:
            if row["team"] and row["opponent_team"]:
                lookup[(row["team"], row["opponent_team"])] = row["gw"]
        if len(resp.data) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return lookup


def pick_columns(row: pd.Series, candidates: list[tuple]) -> tuple | None:
    for cols in candidates:
        if all(c in row.index and pd.notna(row[c]) for c in cols):
            return tuple(row[c] for c in cols)
    return None


def build_odds_row(row: pd.Series, season: str, gw_lookup: dict[tuple[str, str], int]) -> dict | None:
    team_h = map_team_name(row["HomeTeam"])
    team_a = map_team_name(row["AwayTeam"])

    gw = gw_lookup.get((team_h, team_a))
    if gw is None:
        log.warning("No gw match for %s vs %s in season %s -- skipping", team_h, team_a, season)
        return None

    h2h_prices = pick_columns(row, H2H_COLUMNS_PREFERENCE)
    if h2h_prices is None:
        log.warning("No usable h2h odds columns for %s vs %s -- skipping", team_h, team_a)
        return None
    home_win_prob, draw_prob, away_win_prob = normalize_probs([decimal_odds_to_prob(p) for p in h2h_prices])

    implied_total_goals = None
    totals_prices = pick_columns(row, TOTALS_COLUMNS_PREFERENCE)
    if totals_prices is not None:
        over_price, under_price = totals_prices
        over_prob, _ = normalize_probs([decimal_odds_to_prob(over_price), decimal_odds_to_prob(under_price)])
        implied_total_goals = poisson_implied_total_goals(over_prob, TOTALS_LINE)

    return {
        "season": season,
        "gw": gw,
        "team_h": team_h,
        "team_a": team_a,
        "home_win_prob": home_win_prob,
        "draw_prob": draw_prob,
        "away_win_prob": away_win_prob,
        "implied_total_goals": implied_total_goals,
    }


def process_season(season: str) -> int:
    df = fetch_match_df(season)
    gw_lookup = fetch_gw_lookup(season)

    rows = []
    for _, row in df.iterrows():
        odds_row = build_odds_row(row, season, gw_lookup)
        if odds_row is not None:
            rows.append(odds_row)

    upsert_in_batches(admin_client(), "fixture_odds", rows)
    return len(rows)


if __name__ == "__main__":
    log.info("Starting historical odds backfill for seasons: %s", ", ".join(SEASON_CODES))

    for season in SEASON_CODES:
        row_count = process_season(season)
        log.info("Season %s: upserted %d fixture-odds rows", season, row_count)

    log.info("Historical odds backfill complete")
