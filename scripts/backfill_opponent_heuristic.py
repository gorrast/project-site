"""
One-off backfill: guess team_stats.opponent_id for a season whose FPL
draft league is no longer reachable via the API, by porting the existing
score-matching heuristic from components/bluebaycup/BlueBayCup.tsx
(fetchTeamGameweekData): for a team's per-gameweek points_against delta,
find the OTHER team in the same season whose per-gameweek points_for delta
equals that value. Ambiguous (0 or 2+ matches) gameweeks are left NULL and
logged for manual review — this is a guess, not ground truth.

Dry-run by default; pass --apply to actually write.

Usage:
    python scripts/backfill_opponent_heuristic.py --season-id 2
    python scripts/backfill_opponent_heuristic.py --season-id 2 --apply
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
log = logging.getLogger("backfill_opponent_heuristic")


def guess_opponents(team_ids: list, all_stats: list) -> dict:
    """Returns {(team_id, gameweek): (opponent_team_id | None, reason)}.

    Stage 1 — per-gameweek mutual-consistency matching: finds every pair of
    teams that is MUTUALLY consistent (A's pointsAgainst == B's score AND
    B's pointsAgainst == A's score) and enumerates all ways to pair up every
    team that gameweek using only such edges. If exactly one full pairing is
    possible, every team resolves. If several are possible, pairs that
    appear in ALL of them are still safely resolved (only the pairs that
    actually vary between valid pairings are genuinely ambiguous) — a
    one-directional "someone else also scored this" check alone over-reports
    ambiguity, since it ignores the reverse constraint and the fact that
    other pairs in the same gameweek narrow things down by elimination.

    Stage 2 — expected meeting-count elimination: a season of G gameweeks
    with N teams (so N-1 possible opponents) can't split evenly unless
    G % (N-1) == 0, so exactly `G % (N-1)` opponents MUST be met
    `G // (N-1) + 1` times and the rest exactly `G // (N-1)` times — this is
    forced by the schedule, not a guess (verified against a season with real
    API-confirmed data: every team matched this split exactly). For a
    gameweek where stage 1 leaves multiple valid pairings, this stage checks
    each candidate pairing against every involved team's actual meeting
    counts so far: only a pairing that leaves EVERY team's final tally
    matching the required split is viable. If exactly one candidate survives
    that check, it's adopted — this is how a team's last remaining game can
    be deduced even when its per-gameweek score data alone is ambiguous.
    """
    stats_by_team: dict = {}
    for s in all_stats:
        stats_by_team.setdefault(s["team_id"], []).append(s)
    for stats in stats_by_team.values():
        stats.sort(key=lambda s: s["gameweek"])

    per_gw: dict = {}
    for team_id, stats in stats_by_team.items():
        per_gw[team_id] = {}
        for i, stat in enumerate(stats):
            prev = stats[i - 1] if i > 0 else None
            per_gw[team_id][stat["gameweek"]] = {
                "fplScore": stat["points_for"] - (prev["points_for"] if prev else 0),
                "pointsAgainst": stat["points_against"] - (prev["points_against"] if prev else 0),
            }

    gameweeks = sorted({gw for scores in per_gw.values() for gw in scores if gw != 0})

    guesses: dict = {}
    ambiguous_matchings: dict = {}

    for gw in gameweeks:
        teams_this_gw = [t for t in team_ids if gw in per_gw.get(t, {})]

        def compatible(a, b):
            da, db = per_gw[a][gw], per_gw[b][gw]
            return da["pointsAgainst"] == db["fplScore"] and db["pointsAgainst"] == da["fplScore"]

        adjacency = {t: [] for t in teams_this_gw}
        for i, a in enumerate(teams_this_gw):
            for b in teams_this_gw[i + 1:]:
                if compatible(a, b):
                    adjacency[a].append(b)
                    adjacency[b].append(a)

        matchings: list = []

        def backtrack(remaining, current):
            if len(matchings) > 500:
                return
            if not remaining:
                matchings.append(list(current))
                return
            first = remaining[0]
            rest = remaining[1:]
            for other in adjacency[first]:
                if other in rest:
                    pair = (first, other) if first < other else (other, first)
                    current.append(pair)
                    backtrack([t for t in rest if t != other], current)
                    current.pop()

        backtrack(teams_this_gw, [])

        if not matchings:
            for t in teams_this_gw:
                guesses[(t, gw)] = (None, "no consistent pairing found")
            continue

        matching_sets = [set(m) for m in matchings]
        common_pairs = set.intersection(*matching_sets)

        resolved_teams = set()
        for a, b in common_pairs:
            reason = "unique match" if len(matchings) == 1 else "resolved by elimination"
            guesses[(a, gw)] = (b, reason)
            guesses[(b, gw)] = (a, reason)
            resolved_teams.add(a)
            resolved_teams.add(b)

        unresolved_teams = [t for t in teams_this_gw if t not in resolved_teams]
        if not unresolved_teams:
            continue

        for t in unresolved_teams:
            opponents = {p[1] if p[0] == t else p[0] for m in matchings for p in m if t in p}
            guesses[(t, gw)] = (None, f"ambiguous ({len(opponents)} candidates across valid pairings)")

        variants = []
        for m in matchings:
            variant = sorted(p for p in m if p not in common_pairs)
            if variant not in variants:
                variants.append(variant)
        ambiguous_matchings[gw] = variants

    # Stage 2: resolve remaining ties via the expected meeting-count split.
    num_gameweeks = max(gameweeks) if gameweeks else 0
    opponents_count = len(team_ids) - 1
    if opponents_count > 0 and num_gameweeks > 0 and ambiguous_matchings:
        floor_count = num_gameweeks // opponents_count
        remainder = num_gameweeks % opponents_count
        expected_multiset = sorted([floor_count + 1] * remainder + [floor_count] * (opponents_count - remainder))

        resolved_counts: dict = {}
        for (t, _gw), (opp, _reason) in guesses.items():
            if opp is not None:
                resolved_counts[(t, opp)] = resolved_counts.get((t, opp), 0) + 1

        for gw, variants in ambiguous_matchings.items():
            if len(variants) < 2:
                continue
            teams_involved = {t for variant in variants for pair in variant for t in pair}

            valid_variants = []
            for variant in variants:
                opponent_of = {t: (p[1] if p[0] == t else p[0]) for p in variant for t in p}
                ok = True
                for t in teams_involved:
                    opp = opponent_of.get(t)
                    if opp is None:
                        continue
                    counts = []
                    for o in team_ids:
                        if o == t:
                            continue
                        c = resolved_counts.get((t, o), 0)
                        if o == opp:
                            c += 1
                        counts.append(c)
                    if sorted(counts) != expected_multiset:
                        ok = False
                        break
                if ok:
                    valid_variants.append(variant)

            if len(valid_variants) == 1:
                for a, b in valid_variants[0]:
                    guesses[(a, gw)] = (b, "resolved via expected meeting-count distribution")
                    guesses[(b, gw)] = (a, "resolved via expected meeting-count distribution")

    return guesses


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season-id", type=int, required=True)
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default: dry-run only)")
    args = parser.parse_args()

    client = anon_client()

    teams = client.table("teams").select("team_id, team_name").eq("season_id", args.season_id).execute().data
    if not teams:
        log.error("No teams found for season_id=%s", args.season_id)
        sys.exit(1)
    team_ids = [t["team_id"] for t in teams]
    team_names = {t["team_id"]: t["team_name"] for t in teams}

    all_stats = client.table("team_stats").select("*").in_("team_id", team_ids).order("gameweek").execute().data
    if not all_stats:
        log.error("No team_stats found for season_id=%s", args.season_id)
        sys.exit(1)

    guesses = guess_opponents(team_ids, all_stats)

    print(f"\n{'team':>20} {'gw':>3}  {'guessed opponent':>20}   status")
    resolved, ambiguous, no_match = 0, 0, 0
    for (team_id, gw), (opponent_id, reason) in sorted(guesses.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        opponent_name = team_names.get(opponent_id, "-") if opponent_id else "-"
        print(f"{team_names.get(team_id, team_id):>20} {gw:>3}  {opponent_name:>20}   {reason}")
        if opponent_id is not None:
            resolved += 1
        elif "ambiguous" in reason:
            ambiguous += 1
        else:
            no_match += 1

    print(f"\n{resolved} resolved, {ambiguous} ambiguous (left NULL), {no_match} no-match (left NULL).")
    if ambiguous or no_match:
        log.warning(
            "%d gameweek(s) could not be resolved unambiguously — these will stay NULL and can be "
            "manually corrected later via the Supabase SQL editor if you can determine the real opponent.",
            ambiguous + no_match,
        )

    if not args.apply:
        print("\nDry run only — pass --apply to write the resolved guesses.")
        return

    write_client = admin_client()
    applied = 0
    for (team_id, gw), (opponent_id, _reason) in guesses.items():
        if opponent_id is None:
            continue
        write_client.table("team_stats").update({"opponent_id": opponent_id}).eq("team_id", team_id).eq("gameweek", gw).execute()
        applied += 1
    log.info("Applied %d update(s).", applied)


if __name__ == "__main__":
    main()
