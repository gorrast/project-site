import logging
import os
import sys

import requests

from config import CURRENT_SEASON
from odds_utils import decimal_odds_to_prob, normalize_probs, poisson_implied_total_goals
from supabase_client import admin_client, upsert_in_batches

BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"
ODDS_API_URL = "https://api.the-odds-api.com/v4/sports/soccer_epl/odds/"

TOTALS_LINE = 2.5

# Odds API team name -> FPL team name. Only the names that actually differ need
# an entry; a name absent from this map is assumed to already match FPL's naming.
# Unmapped names encountered at runtime are logged loudly rather than silently
# dropped -- reconcile any new ones by hand per the handoff's own instruction.
ODDS_API_TEAM_MAP = {
    "Tottenham Hotspur": "Spurs",
    "Nottingham Forest": "Nott'm Forest",
    "Wolverhampton Wanderers": "Wolves",
    "Brighton and Hove Albion": "Brighton",
    "Newcastle United": "Newcastle",
    "Manchester United": "Man Utd",
    "Manchester City": "Man City",
    "West Ham United": "West Ham",
    "Leeds United": "Leeds",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("sync_odds")


def get_json(url: str, params: dict | None = None) -> dict | list:
    try:
        resp = requests.get(url, params=params, timeout=30)
    except requests.RequestException as e:
        log.error("Request to %s failed: %s", url, e)
        sys.exit(1)

    if resp.status_code != 200:
        log.error("%s returned status %d: %s", url, resp.status_code, resp.text[:500])
        sys.exit(1)

    return resp.json()


def fpl_fixture_index(bootstrap: dict) -> dict[tuple[str, str], int]:
    """(team_h_name, team_a_name) -> gw, for fixtures not yet played."""
    teams_by_id = {t["id"]: t["name"] for t in bootstrap["teams"]}
    fixtures = get_json(FIXTURES_URL)

    index = {}
    for f in fixtures:
        if f.get("finished") or f.get("event") is None:
            continue
        team_h = teams_by_id.get(f["team_h"])
        team_a = teams_by_id.get(f["team_a"])
        if team_h and team_a:
            index[(team_h, team_a)] = f["event"]
    return index


def map_team_name(name: str, valid_names: set[str]) -> str:
    mapped = ODDS_API_TEAM_MAP.get(name, name)
    if mapped not in valid_names:
        log.warning("Odds-API team '%s' (mapped to '%s') doesn't match any known FPL team name", name, mapped)
    return mapped


def average_h2h_probs(event: dict, team_h: str, team_a: str, valid_names: set[str]) -> tuple[float, float, float] | None:
    home_prices, draw_prices, away_prices = [], [], []
    for bookmaker in event.get("bookmakers", []):
        market = next((m for m in bookmaker.get("markets", []) if m["key"] == "h2h"), None)
        if market is None:
            continue
        for outcome in market["outcomes"]:
            mapped_name = map_team_name(outcome["name"], valid_names) if outcome["name"] != "Draw" else "Draw"
            if mapped_name == team_h:
                home_prices.append(outcome["price"])
            elif mapped_name == team_a:
                away_prices.append(outcome["price"])
            elif mapped_name == "Draw":
                draw_prices.append(outcome["price"])

    if not (home_prices and draw_prices and away_prices):
        return None

    avg_home = sum(home_prices) / len(home_prices)
    avg_draw = sum(draw_prices) / len(draw_prices)
    avg_away = sum(away_prices) / len(away_prices)

    raw_probs = [decimal_odds_to_prob(p) for p in (avg_home, avg_draw, avg_away)]
    home_prob, draw_prob, away_prob = normalize_probs(raw_probs)
    return home_prob, draw_prob, away_prob


def average_over_prob(event: dict) -> float | None:
    over_prices, under_prices = [], []
    for bookmaker in event.get("bookmakers", []):
        market = next((m for m in bookmaker.get("markets", []) if m["key"] == "totals"), None)
        if market is None:
            continue
        for outcome in market["outcomes"]:
            if outcome.get("point") != TOTALS_LINE:
                continue
            if outcome["name"] == "Over":
                over_prices.append(outcome["price"])
            elif outcome["name"] == "Under":
                under_prices.append(outcome["price"])

    if not (over_prices and under_prices):
        return None

    avg_over = sum(over_prices) / len(over_prices)
    avg_under = sum(under_prices) / len(under_prices)
    over_prob, _ = normalize_probs([decimal_odds_to_prob(avg_over), decimal_odds_to_prob(avg_under)])
    return over_prob


def build_odds_rows(
    odds_events: list[dict], fixture_index: dict[tuple[str, str], int], valid_names: set[str]
) -> list[dict]:
    rows = []
    for event in odds_events:
        team_h = map_team_name(event["home_team"], valid_names)
        team_a = map_team_name(event["away_team"], valid_names)

        gw = fixture_index.get((team_h, team_a))
        if gw is None:
            log.warning("No matching FPL fixture for odds event %s vs %s -- skipping", team_h, team_a)
            continue

        h2h = average_h2h_probs(event, team_h, team_a, valid_names)
        if h2h is None:
            log.warning("No h2h odds for %s vs %s -- skipping", team_h, team_a)
            continue
        home_win_prob, draw_prob, away_win_prob = h2h

        over_prob = average_over_prob(event)
        implied_total_goals = poisson_implied_total_goals(over_prob, TOTALS_LINE) if over_prob is not None else None

        rows.append(
            {
                "season": CURRENT_SEASON,
                "gw": gw,
                "team_h": team_h,
                "team_a": team_a,
                "home_win_prob": home_win_prob,
                "draw_prob": draw_prob,
                "away_win_prob": away_win_prob,
                "implied_total_goals": implied_total_goals,
            }
        )
    return rows


if __name__ == "__main__":
    api_key = os.environ["ODDS_API_KEY"]

    log.info("Starting odds sync for %s", CURRENT_SEASON)

    bootstrap = get_json(BOOTSTRAP_URL)
    fixture_index = fpl_fixture_index(bootstrap)
    valid_names = {t["name"] for t in bootstrap["teams"]}

    odds_events = get_json(
        ODDS_API_URL,
        params={
            "apiKey": api_key,
            "regions": "uk",
            "markets": "h2h,totals",
            "oddsFormat": "decimal",
        },
    )

    rows = build_odds_rows(odds_events, fixture_index, valid_names)
    upsert_in_batches(admin_client(), "fixture_odds", rows)

    log.info("Odds sync complete: upserted %d fixture rows", len(rows))
