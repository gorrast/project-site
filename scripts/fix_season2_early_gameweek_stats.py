"""
One-off repair: season 2's team_stats has correct points_for/points_against
every gameweek, but wins/draws/losses/total_points are stuck at 0 for
gameweeks 1-9 for EVERY team (a historical data-entry bug, not something
introduced by the opponent_id backfill) before "catching up" to the correct
cumulative value at gameweek 10 onward. Confirmed via every team's gw38
total_points already matching what a correct recompute gives — this fixes
the wrong INTERMEDIATE weekly snapshots (which corrupts Performance-Over-Time
charts and undercounts Head-to-Head), not final standings/medals/prize money.

Recomputes wins/draws/losses/total_points/rank for gameweeks 1-9 from the
now-correct opponent_id + untouched points_for/points_against, using the same
server-side W/D/L derivation as submit_gameweek (higher score wins). Leaves
gameweek 0 and gameweeks 10-38 untouched (already correct).

Dry-run by default; pass --apply to actually write.

Usage:
    python scripts/fix_season2_early_gameweek_stats.py
    python scripts/fix_season2_early_gameweek_stats.py --apply
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

from api import admin_client, anon_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", stream=sys.stdout)
log = logging.getLogger("fix_season2_early_gameweek_stats")

SEASON_ID = 2
BAD_GAMEWEEKS = range(1, 10)  # 1-9 inclusive


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default: dry-run only)")
    args = parser.parse_args()

    client = anon_client()

    teams = client.table("teams").select("team_id, team_name").eq("season_id", SEASON_ID).execute().data
    team_names = {t["team_id"]: t["team_name"] for t in teams}
    team_ids = [t["team_id"] for t in teams]

    all_stats = client.table("team_stats").select("*").in_("team_id", team_ids).order("gameweek").execute().data
    by_team = {}
    for s in all_stats:
        by_team.setdefault(s["team_id"], []).append(s)
    for stats in by_team.values():
        stats.sort(key=lambda s: s["gameweek"])

    per_gw_score = {}
    for tid, stats in by_team.items():
        per_gw_score[tid] = {}
        prev = None
        for s in stats:
            per_gw_score[tid][s["gameweek"]] = s["points_for"] - (prev["points_for"] if prev else 0)
            prev = s

    # Recompute the full correct cumulative series per team (gw1-38), so
    # gameweeks after the bad range still have the right baseline to check
    # against (they already match, but this also gives us corrected rows to
    # write, plus a rank recompute for the bad gameweeks below).
    corrected_by_team_gw = {}
    max_gw = max(s["gameweek"] for stats in by_team.values() for s in stats)
    for tid, stats in by_team.items():
        prev_correct = {"wins": 0, "draws": 0, "losses": 0, "total_points": 0}
        for s in stats:
            gw = s["gameweek"]
            if gw == 0:
                corrected_by_team_gw[(tid, gw)] = dict(prev_correct)
                continue
            opp = s["opponent_id"]
            my_score = per_gw_score[tid][gw]
            opp_score = per_gw_score[opp][gw]
            result = "W" if my_score > opp_score else ("L" if my_score < opp_score else "D")
            prev_correct = {
                "wins": prev_correct["wins"] + (1 if result == "W" else 0),
                "draws": prev_correct["draws"] + (1 if result == "D" else 0),
                "losses": prev_correct["losses"] + (1 if result == "L" else 0),
                "total_points": prev_correct["total_points"] + (3 if result == "W" else (1 if result == "D" else 0)),
            }
            corrected_by_team_gw[(tid, gw)] = dict(prev_correct)

    # Recompute rank per bad gameweek (total_points changes -> ranking among
    # all 10 teams that gameweek may change too), same tie-break as elsewhere:
    # (-total_points, -points_for).
    planned_updates = []
    for gw in BAD_GAMEWEEKS:
        rows_this_gw = []
        for tid in team_ids:
            stat = next(s for s in by_team[tid] if s["gameweek"] == gw)
            corrected = corrected_by_team_gw[(tid, gw)]
            rows_this_gw.append({"team_id": tid, "points_for": stat["points_for"], **corrected, "old": stat})
        rows_this_gw.sort(key=lambda r: (-r["total_points"], -r["points_for"]))
        for i, row in enumerate(rows_this_gw):
            rank = i + 1
            old = row["old"]
            changed = (old["wins"], old["draws"], old["losses"], old["total_points"], old["rank"]) != (
                row["wins"], row["draws"], row["losses"], row["total_points"], rank,
            )
            planned_updates.append(
                {
                    "team_id": row["team_id"],
                    "gameweek": gw,
                    "wins": row["wins"],
                    "draws": row["draws"],
                    "losses": row["losses"],
                    "total_points": row["total_points"],
                    "rank": rank,
                    "changed": changed,
                }
            )

    print(f"\n{'team':>20} {'gw':>3}  {'old (w,d,l,pts,rank)':>24}   {'new (w,d,l,pts,rank)':>24}")
    changed_count = 0
    for u in sorted(planned_updates, key=lambda u: (u["team_id"], u["gameweek"])):
        old = next(s for s in by_team[u["team_id"]] if s["gameweek"] == u["gameweek"])
        old_tuple = (old["wins"], old["draws"], old["losses"], old["total_points"], old["rank"])
        new_tuple = (u["wins"], u["draws"], u["losses"], u["total_points"], u["rank"])
        marker = "  <-- CHANGE" if u["changed"] else ""
        if u["changed"]:
            changed_count += 1
        print(f"{team_names[u['team_id']]:>20} {u['gameweek']:>3}  {str(old_tuple):>24}   {str(new_tuple):>24}{marker}")

    print(f"\n{len(planned_updates)} row(s) examined, {changed_count} would change.")

    # Sanity check: final (max gameweek) totals must be untouched by this fix.
    for tid in team_ids:
        final_stat = next(s for s in by_team[tid] if s["gameweek"] == max_gw)
        final_correct = corrected_by_team_gw[(tid, max_gw)]
        assert final_stat["total_points"] == final_correct["total_points"], (
            f"SAFETY CHECK FAILED: team {tid}'s final total_points would change ({final_stat['total_points']} -> "
            f"{final_correct['total_points']}) — aborting, this script should never alter final standings."
        )
    print("Safety check passed: no team's final (gw38) total_points changes.")

    if not args.apply:
        print("\nDry run only — pass --apply to write these changes.")
        return

    write_client = admin_client()
    applied = 0
    for u in planned_updates:
        if not u["changed"]:
            continue
        write_client.table("team_stats").update(
            {
                "wins": u["wins"],
                "draws": u["draws"],
                "losses": u["losses"],
                "total_points": u["total_points"],
                "rank": u["rank"],
            }
        ).eq("team_id", u["team_id"]).eq("gameweek", u["gameweek"]).execute()
        applied += 1
    log.info("Applied %d update(s).", applied)


if __name__ == "__main__":
    main()
