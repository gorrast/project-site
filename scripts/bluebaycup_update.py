import logging
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_file(PROJECT_ROOT / ".env.local")
load_env_file(PROJECT_ROOT / ".env")

from api import anon_client, admin_client
import requests

# Manual response-inspection mode (calls input() in a loop) — only ever
# enabled explicitly for local debugging. Defaults off, so it can never fire
# in CI even if left on by accident (no stdin there, would just hang/EOF).
debug = os.environ.get("BLUEBAYCUP_DEBUG") == "1"

# ---------------------------------------------------------------------------
# Logging
#
# GitHub Actions captures each step's stdout/stderr automatically and keeps it
# in the run log (default 90-day retention, configurable in repo settings) —
# no committed .log file needed. logging.basicConfig below sends everything
# there.
#
# The gha_* helpers additionally emit GitHub Actions "workflow commands"
# (docs: https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions),
# which turn a line into a highlighted annotation on the run's summary page —
# distinct from the raw log, good for seeing "did this actually work" at a
# glance without reading the full output.
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("bluebaycup_update")


def gha_notice(message: str) -> None:
    print(f"::notice::{message}")


def gha_warning(message: str) -> None:
    print(f"::warning::{message}")


def gha_error(message: str) -> None:
    print(f"::error::{message}")


def write_summary(lines: list) -> None:
    """Append a section to the run's Job Summary (visible on the Actions run
    page, not committed anywhere — see the $GITHUB_STEP_SUMMARY docs)."""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    with open(summary_path, "a") as f:
        f.write("\n".join(lines) + "\n\n")


def api_request(league_id: int) -> dict:
    url = f"https://draft.premierleague.com/api/league/{league_id}/details"
    try:
        response = requests.get(url, timeout=15)
    except requests.RequestException as e:
        log.error("Request to FPL API failed: %s", e)
        gha_error(f"Request to FPL API failed: {e}")
        sys.exit(1)

    if response.status_code != 200:
        log.error("FPL API returned status %s for league %s", response.status_code, league_id)
        gha_error(f"FPL API returned status {response.status_code} for league {league_id}")
        sys.exit(1)

    return response.json()


def fetch_supabase_data() -> dict:
    """
    Fetch the needed data from supabase:
        - league_api_id: id for our particular league for the api-request
        - team_output: maps each team's api_id to its bluebaycup team_id
        - max_gw: the most recent gameweek of this season for which we already have data
    """
    client = anon_client()
    season = (
        client.table("seasons")
        .select("season_id, league_api_id")
        .order("season_id", desc=True)
        .execute()
        .data[0]
    )

    teams = (
        client.table("teams")
        .select("team_id, season_id, api_entry_id")
        .eq("season_id", season["season_id"])
        .execute()
        .data
    )
    team_ids = [t["team_id"] for t in teams]

    latest_stats = (
        client.table("team_stats")
        .select("gameweek")
        .in_("team_id", team_ids)
        .order("gameweek", desc=True)
        .limit(1)
        .execute()
        .data
    )
    max_gw = latest_stats[0]["gameweek"] if latest_stats else 0

    team_output = {}
    for team in teams:
        team_output[team["api_entry_id"]] = team["team_id"]

    return {
        "league_api_id": season["league_api_id"],
        "team_output": team_output,
        "max_gw": max_gw,
    }


def insert_new_data(rows_to_insert: list) -> bool:
    client = admin_client()
    try:
        client.table("team_stats").insert(rows_to_insert).execute()
        return True
    except Exception as e:
        log.error("Failed to insert team_stats rows: %s", e)
        gha_error(f"Failed to insert team_stats rows: {e}")
        return False


def update(response: dict, TEAMS: dict, current_gw: int) -> bool:
    """Main update: builds this gameweek's cumulative rows for every team and
    inserts them. Returns True on success, False on failure.

    Relies on the caller having already verified current_gw > MAX_GW (see
    __main__) — a workflow-level concurrency group prevents two runs from
    racing that check, so it isn't re-verified here."""
    rows_to_insert = []
    for player in response["standings"]:
        league_entry = player["league_entry"]
        team_id = TEAMS[league_entry]

        row = {
            "team_id": team_id,
            "gameweek": current_gw,
            "rank": player["rank"],
            "total_points": player["total"],
            "wins": int(player["matches_won"]),
            "draws": int(player["matches_drawn"]),
            "losses": int(player["matches_lost"]),
            "points_for": player["points_for"],
            "points_against": player["points_against"],
        }
        rows_to_insert.append(row)

    if len(rows_to_insert) != len(TEAMS):
        msg = (
            f"Built {len(rows_to_insert)} row(s) for gameweek {current_gw} but this season has "
            f"{len(TEAMS)} team(s) — FPL standings and Supabase teams don't match up"
        )
        log.warning(msg)
        gha_warning(msg)

    return insert_new_data(rows_to_insert)


def print_response(response: dict) -> None:
    """
    For understanding of the data coming from the API. Manual/local use only
    (BLUEBAYCUP_DEBUG=1) — calls input(), so it must never run in CI.
    """
    print("Keys level 1: ")
    print(list(response.keys()))
    print("Enter keys, separated by space. Enter # to quit")
    user_input = input()

    while user_input != "#":
        split_input = user_input.split()
        res = response.copy()
        try:
            for row in split_input:
                res = res[row]
            print("\n\nOutput:")
            print(res)
        except KeyError as e:
            print("Invalid key, try again", e)

        user_input = input()


if __name__ == "__main__":
    log.info("Starting BlueBayCup weekly update")

    db_data = fetch_supabase_data()
    LEAGUE_ID = db_data["league_api_id"]
    TEAMS = db_data["team_output"]
    MAX_GW = db_data["max_gw"]

    response = api_request(LEAGUE_ID)

    if debug:
        print_response(response)
        sys.exit(0)

    gameweek = sum([
        int(response["standings"][0]["matches_drawn"]),
        int(response["standings"][0]["matches_lost"]),
        int(response["standings"][0]["matches_won"]),
    ])

    if gameweek <= MAX_GW:
        msg = f"No new gameweek data (FPL reports GW{gameweek}, already have up to GW{MAX_GW})"
        log.info(msg)
        gha_notice(msg)
        write_summary(["### BlueBayCup update", f"- {msg}"])
        sys.exit(0)

    success = update(response, TEAMS, current_gw=gameweek)

    if not success:
        write_summary(["### BlueBayCup update", f"- Failed to update gameweek {gameweek}"])
        sys.exit(1)

    msg = f"Updated gameweek {gameweek} for {len(TEAMS)} teams"
    log.info(msg)
    gha_notice(msg)
    write_summary(["### BlueBayCup update", f"- {msg}"])
