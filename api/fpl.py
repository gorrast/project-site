from collections import defaultdict
from typing import Optional

import requests
from fastapi import APIRouter, HTTPException, Query
from supabase import Client

from pipeline.config import CURRENT_SEASON

from .clients import anon_client

router = APIRouter(prefix="/api/fpl")

DRAFT_BASE = "https://draft.premierleague.com/api"

# Formation constraints for the starting XI: 1 GKP is fixed, the rest must
# sum to 10 within these per-position bounds.
DEF_BOUNDS = (3, 5)
MID_BOUNDS = (2, 5)
FWD_BOUNDS = (1, 3)


# ---------------------------------------------------------------------------
# Draft API client
# ---------------------------------------------------------------------------


def draft_get(path: str, not_found_detail: Optional[str] = None) -> dict:
    try:
        resp = requests.get(f"{DRAFT_BASE}/{path}", timeout=15)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Failed to reach the FPL Draft API")
    if resp.status_code == 404 and not_found_detail:
        raise HTTPException(status_code=404, detail=not_found_detail)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"FPL Draft API returned status {resp.status_code}")
    return resp.json()


def fetch_bootstrap() -> dict:
    return draft_get("bootstrap-static")


def code_by_element(bootstrap: dict) -> dict:
    return {el["id"]: el["code"] for el in bootstrap["elements"]}


def most_recent_completed_gw(bootstrap: dict) -> int:
    """The current Draft gameweek can itself already be finished (events.current
    is not always the right "next" gw) — so this is the max finished event id,
    not events.current - 1."""
    finished = [e["id"] for e in bootstrap["events"]["data"] if e["finished"]]
    if not finished:
        raise HTTPException(status_code=502, detail="No completed gameweeks found in the FPL Draft API")
    return max(finished)


def normalize_position(position: str) -> str:
    # fpl.features has a known upstream inconsistency where forecast rows
    # label goalkeepers "GK" while historical rows use "GKP" — normalize
    # defensively rather than depending on a pipeline fix.
    return "GKP" if position == "GK" else position


# The only positions Draft FPL squads are built from. fpl.players/fpl.features
# also carry real-life managers ("AM" — FPL's Assistant Manager feature,
# Classic-only) since they share the same underlying player database; those
# must never surface in a Draft-facing route.
VALID_POSITIONS = {"GKP", "DEF", "MID", "FWD"}


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------


def fetch_predictions_for_codes(client: Client, codes: Optional[list] = None) -> dict:
    """Returns {code: {position, xpts_mean, adjusted_xpts, chance_of_playing}}
    for players with a gameweeks_ahead=1 fpl.features row this season. Codes
    with no such row are simply absent from the result (not an error) — right
    now that's every code, since the pipeline hasn't produced ahead=1 rows
    yet for this season; callers must treat an empty result as "predictions
    not available" rather than "no players".

    Pass codes=None to fetch every player with an ahead=1 row (used by the
    players browser); pass an explicit list to scope to a roster (used by
    the team route).
    """
    if codes is not None and not codes:
        return {}

    features_query = (
        client.schema("fpl")
        .table("features")
        .select("player_id, fixture, position, chance_of_playing")
        .eq("season", CURRENT_SEASON)
        .eq("gameweeks_ahead", 1)
    )
    if codes is not None:
        features_query = features_query.in_("player_id", codes)
    features_rows = features_query.execute().data
    if not features_rows:
        return {}

    features_by_player = defaultdict(list)
    for f in features_rows:
        features_by_player[f["player_id"]].append(f)

    predictions_rows = (
        client.schema("fpl")
        .table("predictions")
        .select("player_id, fixture, xpts_mean")
        .eq("season", CURRENT_SEASON)
        .in_("player_id", list(features_by_player.keys()))
        .execute()
        .data
    )
    predictions_by_key = {(p["player_id"], p["fixture"]): p["xpts_mean"] for p in predictions_rows}

    result = {}
    for code, feats in features_by_player.items():
        position = normalize_position(feats[0]["position"])
        if position not in VALID_POSITIONS:
            continue  # e.g. "AM" (real-life managers) — not a Draft-eligible position
        chance_of_playing = next((f["chance_of_playing"] for f in feats if f["chance_of_playing"] is not None), None)

        # Sum across fixtures so a double gameweek is handled correctly (mirrors
        # fpl.gameweek_predictions' sum-across-fixtures approach).
        total = 0.0
        found_any = False
        for f in feats:
            xm = predictions_by_key.get((code, f["fixture"]))
            if xm is not None:
                total += xm
                found_any = True
        xpts_mean = total if found_any else None

        adjusted_xpts = (
            xpts_mean * (chance_of_playing / 100)
            if xpts_mean is not None and chance_of_playing is not None
            else xpts_mean
        )
        result[code] = {
            "position": position,
            "xpts_mean": xpts_mean,
            "adjusted_xpts": adjusted_xpts,
            "chance_of_playing": chance_of_playing,
        }
    return result


# ---------------------------------------------------------------------------
# Starting XI optimizer (Task 2) — exact, not a heuristic: for any fixed
# valid (def, mid, fwd) split the optimal pick is just top-N per position by
# adjusted_xpts (no cross-position interaction), so we enumerate every valid
# split and keep the best-scoring one. PuLP would be overkill here.
# ---------------------------------------------------------------------------


def pick_best_starting_xi(roster: list) -> tuple:
    by_position = defaultdict(list)
    for p in roster:
        by_position[p["position"]].append(p)
    for players in by_position.values():
        players.sort(key=lambda p: p["adjusted_xpts"] or 0.0, reverse=True)

    gkps = by_position.get("GKP", [])
    if not gkps:
        raise HTTPException(status_code=500, detail="Roster has no goalkeeper — cannot form a valid starting XI")
    gkp = gkps[0]

    defs, mids, fwds = by_position.get("DEF", []), by_position.get("MID", []), by_position.get("FWD", [])

    best_starters = None
    best_score = -1.0
    for d in range(DEF_BOUNDS[0], DEF_BOUNDS[1] + 1):
        for m in range(MID_BOUNDS[0], MID_BOUNDS[1] + 1):
            f = 10 - d - m
            if f < FWD_BOUNDS[0] or f > FWD_BOUNDS[1]:
                continue
            if d > len(defs) or m > len(mids) or f > len(fwds):
                continue
            starters = [gkp] + defs[:d] + mids[:m] + fwds[:f]
            score = sum(p["adjusted_xpts"] or 0.0 for p in starters)
            if score > best_score:
                best_score = score
                best_starters = starters

    if best_starters is None:
        raise HTTPException(status_code=500, detail="Roster does not support any valid formation (3-5 DEF, 2-5 MID, 1-3 FWD)")

    starting_codes = {p["code"] for p in best_starters}
    bench = [p for p in roster if p["code"] not in starting_codes]
    bench.sort(key=lambda p: p["adjusted_xpts"] or 0.0, reverse=True)

    return best_starters, bench


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/team/{team_id}")
def get_team(team_id: int):
    bootstrap = fetch_bootstrap()
    gw = most_recent_completed_gw(bootstrap)
    code_map = code_by_element(bootstrap)

    picks_data = draft_get(
        f"entry/{team_id}/event/{gw}",
        not_found_detail=f"Team {team_id} not found, or has no roster for gameweek {gw}",
    )
    picks = picks_data.get("picks", [])
    if not picks:
        raise HTTPException(status_code=404, detail=f"No roster found for team {team_id} at gameweek {gw}")

    codes = []
    seen = set()
    for pick in picks:
        code = code_map.get(pick["element"])
        if code is not None and code not in seen:
            seen.add(code)
            codes.append(code)

    client = anon_client()
    players_rows = (
        client.schema("fpl")
        .table("players")
        .select("code, name, current_team, current_position")
        .in_("code", codes)
        .execute()
        .data
    )
    players_by_code = {p["code"]: p for p in players_rows}
    predictions_by_code = fetch_predictions_for_codes(client, codes)
    predictions_available = bool(predictions_by_code)

    roster = []
    for code in codes:
        player_row = players_by_code.get(code, {})
        pred = predictions_by_code.get(code)
        # Fall back to fpl.players.current_position when this player has no
        # ahead=1 features row yet (predictions not available, or a very
        # recent transfer the pipeline hasn't ingested) — the optimizer still
        # needs a position to slot them into.
        position = pred["position"] if pred else normalize_position(player_row.get("current_position") or "MID")
        roster.append(
            {
                "code": code,
                "name": player_row.get("name", f"Player {code}"),
                "team": player_row.get("current_team", ""),
                "position": position,
                "xpts_mean": pred["xpts_mean"] if pred else None,
                "adjusted_xpts": pred["adjusted_xpts"] if pred else None,
                "chance_of_playing": pred["chance_of_playing"] if pred else None,
            }
        )

    starting_xi, bench = pick_best_starting_xi(roster)
    total_adjusted_xpts = (
        round(sum(p["adjusted_xpts"] or 0.0 for p in starting_xi), 2) if predictions_available else None
    )

    return {
        "team_id": team_id,
        "gw_used": gw,
        "predictions_available": predictions_available,
        "starting_xi": starting_xi,
        "bench": bench,
        "total_adjusted_xpts": total_adjusted_xpts,
    }


@router.get("/league/{league_id}")
def get_league(league_id: int):
    details = draft_get(f"league/{league_id}/details", not_found_detail=f"League {league_id} not found")
    bootstrap = fetch_bootstrap()
    # The opponent shown alongside a roster should be for the upcoming
    # matchup, not the one already played — bootstrap's "current" event can
    # itself already be finished (see most_recent_completed_gw), so "current"
    # is the wrong thing to key the schedule off of. Rosters (get_team) are
    # deliberately one gw behind this, per the accepted staleness trade-off.
    upcoming_gw = most_recent_completed_gw(bootstrap) + 1

    league_entries = details.get("league_entries", [])
    # `matches` keys teams by an internal league_entry id, distinct from the
    # entry_id used by every other endpoint — map through league_entries and
    # never expose the internal id to the frontend.
    entry_id_by_league_entry = {
        e["id"]: e["entry_id"] for e in league_entries if e.get("entry_id") is not None
    }

    teams = [
        {"team_id": e["entry_id"], "name": e.get("entry_name") or f"Entry {e['entry_id']}"}
        for e in league_entries
        if e.get("entry_id") is not None
    ]

    schedule = []
    for m in details.get("matches", []):
        if m.get("event") != upcoming_gw:
            continue
        team_a = entry_id_by_league_entry.get(m.get("league_entry_1"))
        team_b = entry_id_by_league_entry.get(m.get("league_entry_2"))
        if team_a is None or team_b is None:
            continue
        finished = bool(m.get("finished"))
        schedule.append({"team_id": team_a, "opponent_team_id": team_b, "finished": finished})
        schedule.append({"team_id": team_b, "opponent_team_id": team_a, "finished": finished})

    return {"league_id": league_id, "upcoming_gw": upcoming_gw, "teams": teams, "schedule": schedule}


@router.get("/league/{league_id}/availability")
def get_availability(league_id: int):
    data = draft_get(
        f"league/{league_id}/element-status", not_found_detail=f"League {league_id} not found"
    )
    bootstrap = fetch_bootstrap()
    code_map = code_by_element(bootstrap)

    available_codes = []
    for row in data.get("element_status", []):
        if row.get("owner") is None:
            code = code_map.get(row["element"])
            if code is not None:
                available_codes.append(code)

    return {"league_id": league_id, "available_codes": available_codes}


@router.get("/players")
def get_players(league_id: int = Query(...)):
    client = anon_client()
    predictions_by_code = fetch_predictions_for_codes(client)
    if not predictions_by_code:
        return {"predictions_available": False, "players": []}

    codes = list(predictions_by_code.keys())
    players_rows = (
        client.schema("fpl").table("players").select("code, name, current_team").in_("code", codes).execute().data
    )
    players_by_code = {p["code"]: p for p in players_rows}

    availability = get_availability(league_id)
    available_set = set(availability["available_codes"])

    players = []
    for code, pred in predictions_by_code.items():
        player_row = players_by_code.get(code, {})
        players.append(
            {
                "code": code,
                "name": player_row.get("name", f"Player {code}"),
                "team": player_row.get("current_team", ""),
                "position": pred["position"],
                "xpts_mean": pred["xpts_mean"],
                "adjusted_xpts": pred["adjusted_xpts"],
                "chance_of_playing": pred["chance_of_playing"],
                "available": code in available_set,
            }
        )

    players.sort(key=lambda p: p["adjusted_xpts"] if p["adjusted_xpts"] is not None else -1, reverse=True)
    return {"predictions_available": True, "players": players}
