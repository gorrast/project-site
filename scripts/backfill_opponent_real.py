"""
One-off backfill: populate team_stats.opponent_id for a season whose
FPL draft league is still reachable via the live API, using the real
`matches` array (event -> gameweek, league_entry_1/2 -> team_id via
api_entry_id). Dry-run by default; pass --apply to actually write.

Usage:
    python scripts/backfill_opponent_real.py --season-id 3
    python scripts/backfill_opponent_real.py --season-id 3 --apply
"""

import argparse
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
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(PROJECT_ROOT / ".env.local")
load_env_file(PROJECT_ROOT / ".env")

import requests
from api import admin_client, anon_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", stream=sys.stdout)
log = logging.getLogger("backfill_opponent_real")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season-id", type=int, required=True)
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default: dry-run only)")
    args = parser.parse_args()

    client = anon_client()

    season = client.table("seasons").select("season_id, year, league_api_id").eq("season_id", args.season_id).execute().data
    if not season:
        log.error("No season with season_id=%s", args.season_id)
        sys.exit(1)
    season = season[0]
    league_api_id = season.get("league_api_id")
    if not league_api_id:
        log.error("Season %s (%s) has no league_api_id set", args.season_id, season["year"])
        sys.exit(1)

    teams = client.table("teams").select("team_id, team_name, api_entry_id, player_id").eq("season_id", args.season_id).execute().data
    if not teams:
        log.error("No teams found for season_id=%s", args.season_id)
        sys.exit(1)

    missing_api_id = [t for t in teams if not t.get("api_entry_id")]
    if missing_api_id:
        log.warning(
            "%d team(s) in this season have no api_entry_id set and cannot be matched: %s",
            len(missing_api_id),
            [t["team_name"] for t in missing_api_id],
        )

    entry_to_team = {t["api_entry_id"]: t for t in teams if t.get("api_entry_id")}

    url = f"https://draft.premierleague.com/api/league/{league_api_id}/details"
    log.info("Fetching %s", url)
    try:
        resp = requests.get(url, timeout=15)
    except requests.RequestException as e:
        log.error("Request failed: %s", e)
        sys.exit(1)
    if resp.status_code != 200:
        log.error("FPL API returned status %s — league may no longer be accessible", resp.status_code)
        sys.exit(1)
    matches = resp.json().get("matches", [])
    log.info("Fetched %d matches", len(matches))

    # Existing opponent_id values, for the dry-run diff.
    team_ids = [t["team_id"] for t in teams]
    existing_stats = client.table("team_stats").select("team_id, gameweek, opponent_id").in_("team_id", team_ids).execute().data
    existing_by_key = {(s["team_id"], s["gameweek"]): s.get("opponent_id") for s in existing_stats}

    planned_updates = []
    unmatched_entries = set()
    for m in matches:
        gameweek = m.get("event")
        entry_a, entry_b = m.get("league_entry_1"), m.get("league_entry_2")
        team_a, team_b = entry_to_team.get(entry_a), entry_to_team.get(entry_b)
        if team_a is None:
            unmatched_entries.add(entry_a)
        if team_b is None:
            unmatched_entries.add(entry_b)
        if team_a is None or team_b is None:
            continue
        planned_updates.append((team_a["team_id"], gameweek, team_b["team_id"], team_b["team_name"]))
        planned_updates.append((team_b["team_id"], gameweek, team_a["team_id"], team_a["team_name"]))

    if unmatched_entries:
        log.warning("FPL league_entry id(s) with no matching team via api_entry_id: %s", sorted(unmatched_entries))

    print(f"\n{'team_id':>8} {'gw':>3}  {'old opponent':>14}  ->  {'new opponent':>14}   opponent name")
    changed = 0
    for team_id, gameweek, new_opponent, opponent_name in sorted(planned_updates, key=lambda p: (p[0], p[1])):
        old = existing_by_key.get((team_id, gameweek))
        marker = "" if old == new_opponent else "  <-- CHANGE"
        if old != new_opponent:
            changed += 1
        print(f"{team_id:>8} {gameweek:>3}  {str(old):>14}  ->  {new_opponent:>14}   {opponent_name}{marker}")

    print(f"\n{len(planned_updates)} row(s) examined, {changed} would change.")

    if not args.apply:
        print("\nDry run only — pass --apply to write these changes.")
        return

    log.info("Applying %d update(s)...", changed)
    write_client = admin_client()
    applied = 0
    for team_id, gameweek, new_opponent, _ in planned_updates:
        if existing_by_key.get((team_id, gameweek)) == new_opponent:
            continue
        write_client.table("team_stats").update({"opponent_id": new_opponent}).eq("team_id", team_id).eq("gameweek", gameweek).execute()
        applied += 1
    log.info("Applied %d update(s).", applied)


if __name__ == "__main__":
    main()
