import logging
import sys

import requests

from config import CURRENT_SEASON
from supabase_client import admin_client, upsert_in_batches

BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
LIVE_URL = "https://fantasy.premierleague.com/api/event/{gw}/live/"
FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"
ELEMENT_SUMMARY_URL = "https://fantasy.premierleague.com/api/element-summary/{player_id}/"

FLOAT_STATS = {
    "expected_goals",
    "expected_assists",
    "expected_goal_involvements",
    "expected_goals_conceded",
    "ict_index",
}

INT_STATS = {
    "total_points",
    "minutes",
    "goals_scored",
    "assists",
    "bonus",
    "saves",
    "bps",
    "clearances_blocks_interceptions",
    "defensive_contribution",
    "recoveries",
    "tackles",
}

BOOL_STATS = {"starts", "clean_sheets"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("sync_current_season")


def get_json(url: str, params: dict | None = None) -> dict | list:
    try:
        resp = requests.get(url, params=params, timeout=30)
    except requests.RequestException as e:
        log.error("Request to %s failed: %s", url, e)
        sys.exit(1)

    if resp.status_code != 200:
        log.error("%s returned status %d", url, resp.status_code)
        sys.exit(1)

    return resp.json()


def extract_stats(stats: dict) -> dict:
    """Pulls and type-casts the fields shared between the live /event/{gw}/live/
    `stats` dict and an /element-summary/ `history` entry -- both use identical
    field names for these columns."""
    out = {}
    for col in INT_STATS:
        v = stats.get(col)
        out[col] = None if v is None else int(v)
    for col in FLOAT_STATS:
        v = stats.get(col)
        out[col] = None if v is None else float(v)
    for col in BOOL_STATS:
        v = stats.get(col)
        out[col] = None if v is None else bool(int(v))
    return out


def sync_players(bootstrap: dict) -> tuple[dict[int, int], dict[int, str], dict[int, str]]:
    """Upserts fpl.players from bootstrap-static and returns
    (team_id_by_player, position_by_player, team_name_by_id)."""
    teams_by_id = {t["id"]: t["name"] for t in bootstrap["teams"]}
    positions_by_id = {p["id"]: p["singular_name_short"] for p in bootstrap["element_types"]}

    player_rows = []
    team_by_player: dict[int, int] = {}
    position_by_player: dict[int, str] = {}
    for element in bootstrap["elements"]:
        player_id = element["id"]
        team_id = element["team"]
        position = positions_by_id.get(element["element_type"])
        team_by_player[player_id] = team_id
        position_by_player[player_id] = position
        player_rows.append(
            {
                "id": player_id,
                "name": f"{element['first_name']} {element['second_name']}".strip(),
                "current_team": teams_by_id.get(team_id),
                "current_position": position,
            }
        )

    upsert_in_batches(admin_client(), "players", player_rows)
    return team_by_player, position_by_player, teams_by_id


def fetch_fixtures(gw: int) -> list[dict]:
    return get_json(FIXTURES_URL, params={"event": gw})


def double_gw_team_ids(fixtures: list[dict]) -> set[int]:
    counts: dict[int, int] = {}
    for f in fixtures:
        counts[f["team_h"]] = counts.get(f["team_h"], 0) + 1
        counts[f["team_a"]] = counts.get(f["team_a"], 0) + 1
    return {team_id for team_id, count in counts.items() if count > 1}


def single_fixture_rows(
    live: dict,
    fixtures: list[dict],
    double_teams: set[int],
    team_by_player: dict[int, int],
    position_by_player: dict[int, str],
    teams_by_id: dict[int, str],
    gw: int,
) -> list[dict]:
    team_single_fixture = {}
    for f in fixtures:
        if f["team_h"] not in double_teams:
            team_single_fixture[f["team_h"]] = f
        if f["team_a"] not in double_teams:
            team_single_fixture[f["team_a"]] = f

    rows = []
    for element in live["elements"]:
        player_id = element["id"]
        team_id = team_by_player.get(player_id)
        if team_id is None or team_id in double_teams:
            continue

        fixture = team_single_fixture.get(team_id)
        if fixture is None:
            # Blank gameweek for this player's team.
            continue

        was_home = fixture["team_h"] == team_id
        opponent_id = fixture["team_a"] if was_home else fixture["team_h"]

        rows.append(
            {
                "player_id": player_id,
                "season": CURRENT_SEASON,
                "gw": gw,
                "fixture": fixture["id"],
                "team": teams_by_id.get(team_id),
                "position": position_by_player.get(player_id),
                "opponent_team": teams_by_id.get(opponent_id),
                "was_home": was_home,
                **extract_stats(element["stats"]),
            }
        )
    return rows


def double_fixture_rows(
    double_teams: set[int],
    team_by_player: dict[int, int],
    position_by_player: dict[int, str],
    teams_by_id: dict[int, str],
    gw: int,
) -> list[dict]:
    player_ids = [pid for pid, team_id in team_by_player.items() if team_id in double_teams]

    rows = []
    for player_id in player_ids:
        summary = get_json(ELEMENT_SUMMARY_URL.format(player_id=player_id))
        team_id = team_by_player.get(player_id)
        for entry in summary.get("history", []):
            if entry.get("round") != gw:
                continue
            was_home = entry.get("was_home")
            opponent_id = entry.get("opponent_team")
            rows.append(
                {
                    "player_id": player_id,
                    "season": CURRENT_SEASON,
                    "gw": gw,
                    "fixture": entry["fixture"],
                    "team": teams_by_id.get(team_id),
                    "position": position_by_player.get(player_id),
                    "opponent_team": teams_by_id.get(opponent_id) if opponent_id is not None else None,
                    "was_home": was_home,
                    **extract_stats(entry),
                }
            )
    return rows


def build_stat_rows(
    gw: int,
    team_by_player: dict[int, int],
    position_by_player: dict[int, str],
    teams_by_id: dict[int, str],
) -> list[dict]:
    fixtures = fetch_fixtures(gw)
    double_teams = double_gw_team_ids(fixtures)
    live = get_json(LIVE_URL.format(gw=gw))

    rows = single_fixture_rows(live, fixtures, double_teams, team_by_player, position_by_player, teams_by_id, gw)
    if double_teams:
        log.info("GW%d: double gameweek for team ids %s", gw, sorted(double_teams))
        rows += double_fixture_rows(double_teams, team_by_player, position_by_player, teams_by_id, gw)

    return rows


if __name__ == "__main__":
    log.info("Starting current-season sync for %s", CURRENT_SEASON)

    bootstrap = get_json(BOOTSTRAP_URL)
    team_by_player, position_by_player, teams_by_id = sync_players(bootstrap)

    finished_gws = [e["id"] for e in bootstrap["events"] if e.get("finished") and e.get("data_checked")]
    log.info("Finished gameweeks so far this season: %s", finished_gws)

    total_rows = 0
    for gw in finished_gws:
        rows = build_stat_rows(gw, team_by_player, position_by_player, teams_by_id)
        upsert_in_batches(admin_client(), "raw_gameweek_stats", rows)
        total_rows += len(rows)
        log.info("GW%d: upserted %d fixture rows", gw, len(rows))

    log.info("Current-season sync complete: %d total rows across %d gameweeks", total_rows, len(finished_gws))
