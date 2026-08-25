import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import List, Literal, Optional

import requests
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import Client, create_client

app = FastAPI()

ADMIN_COOKIE = "admin_session"
SESSION_DURATION_MS = 24 * 60 * 60 * 1000


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ---------------------------------------------------------------------------
# Supabase clients
# ---------------------------------------------------------------------------

_anon_client: Optional[Client] = None
_admin_client: Optional[Client] = None


def anon_client() -> Client:
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(
            os.environ["NEXT_PUBLIC_SUPABASE_URL"],
            os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
        )
    return _anon_client


def admin_client() -> Client:
    global _admin_client
    if _admin_client is None:
        _admin_client = create_client(
            os.environ["NEXT_PUBLIC_SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _admin_client


# ---------------------------------------------------------------------------
# Admin auth (mirrors lib/admin-auth.ts byte-for-byte so existing sessions
# and password hashes stay valid)
# ---------------------------------------------------------------------------


def get_secret() -> str:
    secret = os.environ.get("ADMIN_SESSION_SECRET")
    if not secret:
        raise RuntimeError("ADMIN_SESSION_SECRET is not set")
    return secret


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64url_decode(s: str) -> bytes:
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


def sign_session_token(username: str) -> str:
    exp = int(time.time() * 1000) + SESSION_DURATION_MS
    payload = b64url_encode(json.dumps({"username": username, "exp": exp}, separators=(",", ":")).encode())
    sig = b64url_encode(hmac.new(get_secret().encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_session_token(token: str) -> Optional[str]:
    try:
        dot_idx = token.rfind(".")
        if dot_idx == -1:
            return None
        payload = token[:dot_idx]
        sig = token[dot_idx + 1:]

        expected_sig = b64url_encode(hmac.new(get_secret().encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected_sig):
            return None

        data = json.loads(b64url_decode(payload))
        if time.time() * 1000 > data["exp"]:
            return None
        return data["username"]
    except Exception:
        return None


def require_admin(request: Request) -> str:
    token = request.cookies.get(ADMIN_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    username = verify_session_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return username


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class LoginBody(BaseModel):
    username: str
    password: str


class PlayerCreateBody(BaseModel):
    name: str


class Participant(BaseModel):
    type: Literal["existing", "new"]
    playerId: Optional[int] = None
    playerName: Optional[str] = None
    teamName: str
    apiEntryId: int
    draftPick: int


class SeasonCreateBody(BaseModel):
    year: str
    prizePool: float
    highScorePrize: Optional[float] = 0
    league_api_id: int
    participants: List[Participant]


class SeasonUpdateBody(BaseModel):
    year: str
    prizePool: float
    highScorePrize: float
    league_api_id: int


class TeamUpdateBody(BaseModel):
    api_entry_id: int
    draft_pick: int


class GameweekMatch(BaseModel):
    teamAId: int
    teamBId: Optional[int] = None
    teamAScore: float
    teamBScore: Optional[float] = None


class GameweekBody(BaseModel):
    seasonId: int
    gameweek: int
    matches: List[GameweekMatch]


class SeasonStatsBody(BaseModel):
    seasonId: str


# ---------------------------------------------------------------------------
# Public routes
# ---------------------------------------------------------------------------


@app.get("/api/todos")
def get_todos():
    return {"message": "API endpoint ready"}


POINTS_FOR_1ST = 5
POINTS_FOR_2ND = 2
POINTS_FOR_3RD = 1


@app.get("/api/bluebaycup/overall")
def get_overall():
    client = anon_client()

    players = client.table("players").select("player_id, name").execute().data
    seasons = (
        client.table("seasons")
        .select("season_id, year, prize_pool, high_score_prize, league_api_id")
        .order("season_id", desc=True)
        .execute()
        .data
    )
    teams = client.table("teams").select("team_id, player_id, season_id").execute().data
    final_stats = (
        client.table("team_stats")
        .select("team_id, total_points, points_for, points_against, teams!team_stats_team_id_fkey(season_id)")
        .eq("gameweek", 38)
        .execute()
        .data
    )

    finished_season_ids = set()
    for stat in final_stats:
        season_id = (stat.get("teams") or {}).get("season_id")
        if season_id:
            finished_season_ids.add(season_id)

    finished_seasons = [s for s in seasons if s["season_id"] in finished_season_ids]
    finished_team_ids = [t["team_id"] for t in teams if t["season_id"] in finished_season_ids]

    all_gw_stats = (
        client.table("team_stats")
        .select("team_id, gameweek, points_for")
        .in_("team_id", finished_team_ids)
        .order("gameweek", desc=False)
        .execute()
        .data
        if finished_team_ids
        else []
    )

    high_score_winners: dict = {}
    for season in finished_seasons:
        season_teams = [t for t in teams if t["season_id"] == season["season_id"]]
        season_team_ids = {t["team_id"] for t in season_teams}

        by_team: dict = {}
        for s in all_gw_stats:
            if s["team_id"] in season_team_ids:
                by_team.setdefault(s["team_id"], []).append(s)
        for stats in by_team.values():
            stats.sort(key=lambda s: s["gameweek"])

        max_score = -1
        max_team_id = -1
        for team_id, stats in by_team.items():
            for i, stat in enumerate(stats):
                prev_points_for = 0 if i == 0 else stats[i - 1]["points_for"]
                gw_score = stat["points_for"] - prev_points_for
                if gw_score > max_score:
                    max_score = gw_score
                    max_team_id = team_id

        if max_team_id != -1:
            winning_team = next((t for t in season_teams if t["team_id"] == max_team_id), None)
            if winning_team:
                high_score_winners[season["season_id"]] = winning_team["player_id"]

    season_winners: dict = {}
    for season in finished_seasons:
        season_teams = [t for t in teams if t["season_id"] == season["season_id"]]
        standings = []
        for team in season_teams:
            stat = next((s for s in final_stats if s["team_id"] == team["team_id"]), None)
            standings.append(
                {
                    "playerId": team["player_id"],
                    "totalPoints": stat["total_points"] if stat else 0,
                    "pointsFor": stat["points_for"] if stat else 0,
                    "pointsAgainst": stat["points_against"] if stat else 0,
                }
            )
        standings.sort(key=lambda s: -s["totalPoints"])
        season_winners[season["season_id"]] = standings

    def resolve_player_name(player_id):
        p = next((pl for pl in players if pl["player_id"] == player_id), None)
        return p["name"] if p else ""

    trophy_history = []
    for season in finished_seasons:
        top3 = season_winners.get(season["season_id"], [])[:3]
        if not top3:
            continue
        trophy_history.append(
            {
                "seasonId": str(season["season_id"]),
                "seasonName": season["year"],
                "winner": {"playerName": resolve_player_name(top3[0]["playerId"]), "points": top3[0]["totalPoints"]},
                "runnerUp": (
                    {"playerName": resolve_player_name(top3[1]["playerId"]), "points": top3[1]["totalPoints"]}
                    if len(top3) > 1
                    else None
                ),
                "third": (
                    {"playerName": resolve_player_name(top3[2]["playerId"]), "points": top3[2]["totalPoints"]}
                    if len(top3) > 2
                    else None
                ),
                "margin": (top3[0]["totalPoints"] - top3[1]["totalPoints"]) if len(top3) > 1 else None,
            }
        )

    overall_stats = []
    for player in players:
        player_seasons = []
        for season in finished_seasons:
            standings = season_winners.get(season["season_id"])
            if not standings:
                continue
            player_index = next(
                (i for i, s in enumerate(standings) if s["playerId"] == player["player_id"]), -1
            )
            if player_index == -1:
                continue
            rank = player_index + 1
            player_data = standings[player_index]

            overall_points = 0
            if rank == 1:
                overall_points = POINTS_FOR_1ST
            elif rank == 2:
                overall_points = POINTS_FOR_2ND
            elif rank == 3:
                overall_points = POINTS_FOR_3RD

            player_seasons.append(
                {
                    "rank": rank,
                    "seasonId": season["season_id"],
                    "totalPoints": player_data["totalPoints"],
                    "pointsFor": player_data["pointsFor"],
                    "pointsAgainst": player_data["pointsAgainst"],
                    "prizePool": max(0, (season.get("prize_pool") or 0) - (season.get("high_score_prize") or 0)),
                    "highScorePrize": season.get("high_score_prize") or 0,
                    "overallPoints": overall_points,
                }
            )

        gold_medals = sum(1 for s in player_seasons if s["rank"] == 1)
        silver_medals = sum(1 for s in player_seasons if s["rank"] == 2)
        bronze_medals = sum(1 for s in player_seasons if s["rank"] == 3)

        total_overall_points = sum(s["overallPoints"] for s in player_seasons)

        appearances = len(player_seasons)
        avg_points_total = (
            round(sum(s["totalPoints"] for s in player_seasons) / appearances * 10) / 10 if appearances else 0
        )
        avg_points_for = (
            round(sum(s["pointsFor"] for s in player_seasons) / appearances * 10) / 10 if appearances else 0
        )
        avg_points_against = (
            round(sum(s["pointsAgainst"] for s in player_seasons) / appearances * 10) / 10 if appearances else 0
        )

        tot_prize_money = 0.0
        for s in player_seasons:
            prize = 0.0
            if s["rank"] == 1:
                prize = s["prizePool"] * 0.5
            elif s["rank"] == 2:
                prize = s["prizePool"] * 0.3
            elif s["rank"] == 3:
                prize = s["prizePool"] * 0.2
            if high_score_winners.get(s["seasonId"]) == player["player_id"]:
                prize += s["highScorePrize"]
            tot_prize_money += prize

        overall_stats.append(
            {
                "playerId": str(player["player_id"]),
                "playerName": player["name"],
                "rank": 0,
                "appearances": appearances,
                "goldMedals": gold_medals,
                "silverMedals": silver_medals,
                "bronzeMedals": bronze_medals,
                "totalOverallPoints": total_overall_points,
                "avgPointsTotal": avg_points_total,
                "avgPointsFor": avg_points_for,
                "avgPointsAgainst": avg_points_against,
                "totPrizeMoney": round(tot_prize_money),
            }
        )

    overall_stats.sort(key=lambda s: (-s["totalOverallPoints"], -s["avgPointsTotal"]))
    for i, stat in enumerate(overall_stats):
        stat["rank"] = i + 1

    formatted_seasons = []
    for season in seasons:
        start_year, end_year = season["year"].split("/")
        formatted_seasons.append(
            {
                "seasonId": str(season["season_id"]),
                "seasonName": season["year"],
                "startYear": int(start_year),
                "endYear": int(end_year),
                "prizePool": season["prize_pool"],
                "isFinished": season["season_id"] in finished_season_ids,
            }
        )

    latest_season = formatted_seasons[0] if formatted_seasons else None

    return JSONResponse(
        {
            "overallStats": overall_stats,
            "seasons": formatted_seasons,
            "latestSeason": latest_season,
            "trophyHistory": trophy_history,
        },
        headers={"Cache-Control": "public, max-age=3600"},
    )


def derive_gw_results(stats_by_team: dict, teams_by_id: dict, players_by_id: dict) -> dict:
    """For each team, diff consecutive cumulative team_stats rows into a
    chronological list of {gameweek, result, opponentTeamId,
    opponentPlayerName, myScore, oppScore}. Rows with no opponent_id
    (byes / gameweeks with no recorded match) are skipped entirely."""
    results: dict = {}
    for team_id, stats in stats_by_team.items():
        team_results = []
        for i, stat in enumerate(stats):
            opponent_team_id = stat.get("opponent_id")
            if opponent_team_id is None:
                continue

            prev = stats[i - 1] if i > 0 else None
            wins_delta = stat["wins"] - (prev["wins"] if prev else 0)
            draws_delta = stat["draws"] - (prev["draws"] if prev else 0)
            losses_delta = stat["losses"] - (prev["losses"] if prev else 0)

            if wins_delta == 1:
                result = "W"
            elif draws_delta == 1:
                result = "D"
            elif losses_delta == 1:
                result = "L"
            else:
                continue

            opponent_team = teams_by_id.get(opponent_team_id)
            opponent_player = players_by_id.get(opponent_team["player_id"]) if opponent_team else None

            team_results.append(
                {
                    "gameweek": stat["gameweek"],
                    "result": result,
                    "opponentTeamId": opponent_team_id,
                    "opponentPlayerName": opponent_player["name"] if opponent_player else "",
                    "myScore": stat["points_for"] - (prev["points_for"] if prev else 0),
                    "oppScore": stat["points_against"] - (prev["points_against"] if prev else 0),
                }
            )
        results[team_id] = team_results
    return results


@app.post("/api/bluebaycup/season_stats")
def get_season_stats(body: SeasonStatsBody):
    try:
        season_id = int(body.seasonId)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="seasonId is required")

    client = anon_client()

    teams = (
        client.table("teams")
        .select("team_id, player_id, team_name")
        .eq("season_id", season_id)
        .execute()
        .data
    )
    if not teams:
        raise HTTPException(status_code=404, detail="No teams found for this season")

    team_ids = [t["team_id"] for t in teams]
    players = (
        client.table("players")
        .select("player_id, name")
        .in_("player_id", [t["player_id"] for t in teams])
        .execute()
        .data
    )
    all_stats = (
        client.table("team_stats")
        .select("*")
        .in_("team_id", team_ids)
        .order("gameweek", desc=False)
        .execute()
        .data
    )
    if not all_stats:
        raise HTTPException(status_code=404, detail="No stats found for this season")

    stats_by_team: dict = {}
    for stat in all_stats:
        stats_by_team.setdefault(stat["team_id"], []).append(stat)
    for stats in stats_by_team.values():
        stats.sort(key=lambda s: s["gameweek"])

    teams_by_id = {t["team_id"]: t for t in teams}
    players_by_id = {p["player_id"]: p for p in players}
    form_by_team = derive_gw_results(stats_by_team, teams_by_id, players_by_id)

    per_gw_data: dict = {}
    for team_id, stats in stats_by_team.items():
        per_gw_data[team_id] = {}
        for i, stat in enumerate(stats):
            prev = stats[i - 1] if i > 0 else None
            per_gw_data[team_id][stat["gameweek"]] = {
                "fplScore": stat["points_for"] - prev["points_for"] if prev else stat["points_for"],
                "leaguePoints": stat["total_points"] - prev["total_points"] if prev else stat["total_points"],
            }

    luck_factors = {}
    for team_id in team_ids:
        other_ids = [t for t in team_ids if t != team_id]
        sum_expected = 0.0
        sum_actual = 0.0
        for gw, gw_data in per_gw_data.get(team_id, {}).items():
            fpl_score = gw_data["fplScore"]
            league_points = gw_data["leaguePoints"]
            others = [per_gw_data[o][gw]["fplScore"] for o in other_ids if gw in per_gw_data.get(o, {})]
            if not others:
                continue
            p_win = sum(1 for s in others if s < fpl_score) / len(others)
            p_draw = sum(1 for s in others if s == fpl_score) / len(others)
            sum_expected += 3 * p_win + 1 * p_draw
            sum_actual += league_points
        luck_factors[team_id] = round((sum_actual / sum_expected) * 100) / 100 if sum_expected > 0 else 1

    max_gameweek = max(s["gameweek"] for s in all_stats)
    latest_stats = [s for s in all_stats if s["gameweek"] == max_gameweek]

    standings = []
    for stat in latest_stats:
        team = next((t for t in teams if t["team_id"] == stat["team_id"]), None)
        player = next((p for p in players if team and p["player_id"] == team["player_id"]), None)
        standings.append(
            {
                "playerId": str(team["player_id"]) if team else "",
                "playerName": player["name"] if player else "",
                "teamName": team["team_name"] if team else "",
                "totalPoints": stat["total_points"],
                "wins": stat["wins"],
                "draws": stat["draws"],
                "losses": stat["losses"],
                "pointsFor": stat["points_for"],
                "pointsAgainst": stat["points_against"],
                "luckFactor": luck_factors.get(stat["team_id"], 1),
                "form": form_by_team.get(stat["team_id"], [])[-5:],
            }
        )

    standings.sort(key=lambda s: (-s["totalPoints"], -s["pointsFor"], -s["pointsAgainst"]))
    for i, s in enumerate(standings):
        s["rank"] = i + 1

    gameweeks = sorted({s["gameweek"] for s in all_stats})

    progress_data = []
    for team in teams:
        player = next((p for p in players if p["player_id"] == team["player_id"]), None)
        team_stats = [s for s in all_stats if s["team_id"] == team["team_id"]]

        gameweek_data = []
        for gw in gameweeks:
            stat = next((s for s in team_stats if s["gameweek"] == gw), None)
            if not stat:
                gameweek_data.append(
                    {
                        "gameweek": gw, "rank": None, "totalPoints": 0, "pointsFor": 0, "pointsAgainst": 0,
                        "opponentName": None, "opponentTeamId": None,
                    }
                )
                continue
            opponent_team_id = stat.get("opponent_id")
            opponent_team = teams_by_id.get(opponent_team_id) if opponent_team_id else None
            opponent_player = players_by_id.get(opponent_team["player_id"]) if opponent_team else None

            gameweek_data.append(
                {
                    "gameweek": gw,
                    "rank": stat["rank"],
                    "totalPoints": stat["total_points"],
                    "pointsFor": stat["points_for"],
                    "pointsAgainst": stat["points_against"],
                    "opponentName": opponent_player["name"] if opponent_player else None,
                    "opponentTeamId": opponent_team_id,
                }
            )

        progress_data.append(
            {
                "playerId": str(team["player_id"]),
                "playerName": player["name"] if player else team["team_name"],
                "teamId": str(team["team_id"]),
                "gameweeks": gameweek_data,
            }
        )

    max_gw_score = -1
    max_gw_player_name = ""
    max_gw_gameweek = -1
    for team in teams:
        player = next((p for p in players if p["player_id"] == team["player_id"]), None)
        team_stats = sorted([s for s in all_stats if s["team_id"] == team["team_id"]], key=lambda s: s["gameweek"])
        for i, stat in enumerate(team_stats):
            prev_points_for = team_stats[i - 1]["points_for"] if i > 0 else 0
            gw_score = stat["points_for"] - prev_points_for
            if gw_score > max_gw_score:
                max_gw_score = gw_score
                max_gw_gameweek = stat["gameweek"]
                max_gw_player_name = player["name"] if player else team["team_name"]

    high_score_data = (
        {"playerName": max_gw_player_name, "score": max_gw_score, "gameweek": max_gw_gameweek}
        if max_gw_score >= 0
        else None
    )

    return {
        "standings": standings,
        "progressData": progress_data,
        "maxGameweek": max_gameweek,
        "highScoreData": high_score_data,
    }


@app.get("/api/bluebaycup/head_to_head")
def get_head_to_head():
    client = anon_client()

    teams = client.table("teams").select("team_id, player_id, season_id").execute().data
    players = client.table("players").select("player_id, name").execute().data
    team_ids = [t["team_id"] for t in teams]
    all_stats = (
        client.table("team_stats").select("*").in_("team_id", team_ids).order("gameweek", desc=False).execute().data
        if team_ids
        else []
    )

    teams_by_id = {t["team_id"]: t for t in teams}
    players_by_id = {p["player_id"]: p for p in players}

    stats_by_team: dict = {}
    for stat in all_stats:
        stats_by_team.setdefault(stat["team_id"], []).append(stat)
    for stats in stats_by_team.values():
        stats.sort(key=lambda s: s["gameweek"])

    results_by_team = derive_gw_results(stats_by_team, teams_by_id, players_by_id)

    # (playerId, opponentPlayerId) -> chronological list of matches, aggregated
    # across every team_id that player has ever had (i.e. across seasons).
    matchups: dict = {}
    for team_id, matches in results_by_team.items():
        team = teams_by_id.get(team_id)
        if not team:
            continue
        player_id = team["player_id"]
        season_id = team["season_id"]
        for m in matches:
            opponent_team = teams_by_id.get(m["opponentTeamId"])
            if not opponent_team:
                continue
            key = (player_id, opponent_team["player_id"])
            matchups.setdefault(key, []).append(
                {
                    "seasonId": season_id,
                    "gameweek": m["gameweek"],
                    "result": m["result"],
                    "myScore": m["myScore"],
                    "oppScore": m["oppScore"],
                }
            )

    head_to_head: dict = {}
    for (player_id, opponent_player_id), matches in matchups.items():
        matches.sort(key=lambda m: (m["seasonId"], m["gameweek"]))
        wins = sum(1 for m in matches if m["result"] == "W")
        draws = sum(1 for m in matches if m["result"] == "D")
        losses = sum(1 for m in matches if m["result"] == "L")
        total = wins + draws + losses
        win_pct = round((wins + 0.5 * draws) / total * 100, 1) if total else 0.0

        opponent_player = players_by_id.get(opponent_player_id)
        form = [
            {"gameweek": m["gameweek"], "result": m["result"], "myScore": m["myScore"], "oppScore": m["oppScore"]}
            for m in matches[-5:]
        ]

        head_to_head.setdefault(str(player_id), []).append(
            {
                "opponentPlayerId": str(opponent_player_id),
                "opponentPlayerName": opponent_player["name"] if opponent_player else "",
                "wins": wins,
                "draws": draws,
                "losses": losses,
                "winPct": win_pct,
                "form": form,
            }
        )

    for opponents in head_to_head.values():
        opponents.sort(key=lambda o: -o["winPct"])

    return JSONResponse(
        {"headToHead": head_to_head},
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ---------------------------------------------------------------------------
# Admin auth routes
# ---------------------------------------------------------------------------


@app.get("/api/bluebaycup/admin/check")
def admin_check(username: str = Depends(require_admin)):
    return {"authenticated": True, "username": username}


@app.post("/api/bluebaycup/admin/logout")
def admin_logout():
    response = JSONResponse({"success": True})
    response.delete_cookie(ADMIN_COOKIE, path="/")
    return response


@app.post("/api/bluebaycup/admin/login")
def admin_login(body: LoginBody):
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    client = admin_client()
    try:
        result = (
            client.table("admin_credentials")
            .select("username, password_hash, salt")
            .eq("username", body.username)
            .single()
            .execute()
        )
        data = result.data
    except Exception:
        data = None

    if not data:
        hash_password(body.password, secrets.token_hex(16))
        raise HTTPException(status_code=401, detail="Invalid credentials")

    input_hash = hash_password(body.password, data["salt"])
    if not hmac.compare_digest(input_hash, data["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = sign_session_token(body.username)
    response = JSONResponse({"success": True})
    response.set_cookie(
        ADMIN_COOKIE,
        token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=24 * 60 * 60,
        path="/",
    )
    return response


# ---------------------------------------------------------------------------
# Admin CRUD routes
# ---------------------------------------------------------------------------


@app.get("/api/bluebaycup/admin/players")
def list_players(username: str = Depends(require_admin)):
    client = admin_client()
    try:
        result = client.table("players").select("player_id, name").order("name", desc=False).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch players")
    return {"players": result.data}


@app.post("/api/bluebaycup/admin/players")
def create_player(body: PlayerCreateBody, username: str = Depends(require_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    client = admin_client()
    try:
        result = client.table("players").insert({"name": name}).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to create player")
    return {"player": result.data[0]}


@app.get("/api/bluebaycup/admin/fpl-league-entries")
def get_fpl_league_entries(leagueId: int, username: str = Depends(require_admin)):
    url = f"https://draft.premierleague.com/api/league/{leagueId}/details"
    try:
        resp = requests.get(url, timeout=15)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Failed to reach the FPL API")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"FPL API returned status {resp.status_code}")

    data = resp.json()
    league_entries = data.get("league_entries", [])

    # Draft pick order comes from the draft's round-1 choices (permanent history, keyed by
    # each entry's `entry_id`), not from `waiver_pick` on league_entries — that field is a
    # live waiver-priority snapshot that drifts away from draft order as the season progresses.
    draft_pick_by_entry_id: dict[int, int] = {}
    if data.get("league", {}).get("draft_status") == "post":
        try:
            choices_resp = requests.get(f"https://draft.premierleague.com/api/draft/{leagueId}/choices", timeout=15)
        except requests.RequestException:
            choices_resp = None
        if choices_resp is not None and choices_resp.status_code == 200:
            round_one = [c for c in choices_resp.json().get("choices", []) if c.get("round") == 1]
            picks_by_entry_id = {c["entry"]: c["pick"] for c in round_one}
            # Vacant league slots (never joined by a manager) have entry_id None and never
            # appear in the draft choices — exclude them so one empty slot doesn't blank out
            # every real team's draft pick.
            entry_ids = {entry.get("entry_id") for entry in league_entries if entry.get("entry_id") is not None}
            if entry_ids and entry_ids.issubset(picks_by_entry_id.keys()):
                draft_pick_by_entry_id = picks_by_entry_id

    entries = []
    for entry in league_entries:
        team_name = (
            entry.get("entry_name")
            or " ".join(filter(None, [entry.get("player_first_name"), entry.get("player_last_name")]))
            or f"Entry {entry.get('id')}"
        )
        entries.append({
            "entryId": entry.get("id"),
            "teamName": team_name,
            "draftPick": draft_pick_by_entry_id.get(entry.get("entry_id")),
        })

    return {"entries": entries, "draftPickAvailable": bool(draft_pick_by_entry_id)}


@app.get("/api/bluebaycup/admin/season")
def list_seasons(username: str = Depends(require_admin)):
    client = admin_client()
    try:
        result = (
            client.table("seasons")
            .select("season_id, year, prize_pool, high_score_prize, league_api_id")
            .order("season_id", desc=True)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch seasons")
    return {"seasons": result.data}


@app.post("/api/bluebaycup/admin/season")
def create_season(body: SeasonCreateBody, username: str = Depends(require_admin)):
    if not body.year or body.prizePool is None or not body.participants or not body.league_api_id:
        raise HTTPException(status_code=400, detail="year, prizePool, api_id, and participants are required")

    client = admin_client()

    try:
        season_result = (
            client.table("seasons")
            .insert(
                {
                    "year": body.year,
                    "prize_pool": body.prizePool,
                    "high_score_prize": body.highScorePrize or 0,
                    "league_api_id": body.league_api_id,
                }
            )
            .execute()
        )
        season = season_result.data[0]
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to create season")

    resolved_participants = []
    for p in body.participants:
        if p.type == "existing":
            if not p.playerId:
                raise HTTPException(status_code=400, detail="Missing playerId for existing player")
            resolved_participants.append(
                {"player_id": p.playerId, "teamName": p.teamName, "apiEntryId": p.apiEntryId, "draftPick": p.draftPick}
            )
        else:
            name = (p.playerName or "").strip()
            if not name:
                raise HTTPException(status_code=400, detail="Missing name for new player")
            try:
                new_player_result = client.table("players").insert({"name": name}).execute()
                new_player = new_player_result.data[0]
            except Exception:
                raise HTTPException(status_code=500, detail=f"Failed to create player: {p.playerName}")
            resolved_participants.append(
                {
                    "player_id": new_player["player_id"],
                    "teamName": p.teamName,
                    "apiEntryId": p.apiEntryId,
                    "draftPick": p.draftPick,
                }
            )

    teams_to_insert = [
        {
            "player_id": p["player_id"],
            "season_id": season["season_id"],
            "team_name": p["teamName"],
            "api_entry_id": p["apiEntryId"],
            "draft_pick": p["draftPick"],
        }
        for p in resolved_participants
    ]
    try:
        inserted_teams_result = client.table("teams").insert(teams_to_insert).execute()
        inserted_teams = inserted_teams_result.data
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to create teams")

    initial_stats = [
        {
            "team_id": t["team_id"],
            "gameweek": 0,
            "rank": 1,
            "total_points": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "points_for": 0,
            "points_against": 0,
        }
        for t in inserted_teams
    ]
    client.table("team_stats").insert(initial_stats).execute()

    return {"success": True, "seasonId": season["season_id"]}


@app.post("/api/bluebaycup/admin/gameweek")
def submit_gameweek(body: GameweekBody, username: str = Depends(require_admin)):
    if not body.seasonId or body.gameweek is None or not body.matches:
        raise HTTPException(status_code=400, detail="seasonId, gameweek, and matches are required")

    if body.gameweek < 0 or body.gameweek > 38:
        raise HTTPException(status_code=400, detail="Gameweek must be a whole number between 0 and 38")

    client = admin_client()

    season_teams = client.table("teams").select("team_id").eq("season_id", body.seasonId).execute().data
    season_team_ids = {t["team_id"] for t in season_teams}
    if not season_team_ids:
        raise HTTPException(status_code=400, detail="No teams found for this season")

    assigned_team_ids: list = []
    for m in body.matches:
        if m.teamBId is None:
            if m.teamBScore is not None:
                raise HTTPException(status_code=400, detail=f"Team {m.teamAId} has a bye but teamBScore was provided")
        else:
            if m.teamAId == m.teamBId:
                raise HTTPException(status_code=400, detail=f"Team {m.teamAId} cannot play itself")
            if m.teamBScore is None:
                raise HTTPException(status_code=400, detail=f"Missing score for team {m.teamBId}")
        assigned_team_ids.append(m.teamAId)
        if m.teamBId is not None:
            assigned_team_ids.append(m.teamBId)

    if len(assigned_team_ids) != len(set(assigned_team_ids)):
        raise HTTPException(status_code=400, detail="A team appears more than once across the submitted matches")
    if set(assigned_team_ids) != season_team_ids:
        raise HTTPException(status_code=400, detail="Every team in this season must appear exactly once across the matches")

    bye_count = sum(1 for m in body.matches if m.teamBId is None)
    expected_byes = 1 if len(season_team_ids) % 2 == 1 else 0
    if bye_count != expected_byes:
        raise HTTPException(
            status_code=400,
            detail=f"Expected {expected_byes} bye(s) for a {len(season_team_ids)}-team season, got {bye_count}",
        )

    team_ids = list(season_team_ids)

    existing = (
        client.table("team_stats")
        .select("team_id")
        .in_("team_id", team_ids)
        .eq("gameweek", body.gameweek)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail=f"Gameweek {body.gameweek} data already exists for this season")

    prev_gameweek = body.gameweek - 1
    prev_stats: dict = {}
    if prev_gameweek > 0:
        prev = (
            client.table("team_stats")
            .select("team_id, total_points, wins, draws, losses, points_for, points_against")
            .in_("team_id", team_ids)
            .eq("gameweek", prev_gameweek)
            .execute()
        )
        for s in prev.data:
            prev_stats[s["team_id"]] = s

    default_prev = {"total_points": 0, "wins": 0, "draws": 0, "losses": 0, "points_for": 0, "points_against": 0}

    def build_row(team_id: int, opponent_team_id, my_score: float, opp_score, result: Optional[str]):
        prev = prev_stats.get(team_id, default_prev)
        wins_delta = 1 if result == "W" else 0
        draws_delta = 1 if result == "D" else 0
        losses_delta = 1 if result == "L" else 0
        league_points_delta = 3 if result == "W" else (1 if result == "D" else 0)
        return {
            "team_id": team_id,
            "opponent_id": opponent_team_id,
            "total_points": prev["total_points"] + league_points_delta,
            "wins": prev["wins"] + wins_delta,
            "draws": prev["draws"] + draws_delta,
            "losses": prev["losses"] + losses_delta,
            "points_for": prev["points_for"] + my_score,
            "points_against": prev["points_against"] + (opp_score or 0),
        }

    new_stats = []
    for m in body.matches:
        if m.teamBId is None:
            # Bye: no result, no league-points change, FPL score still counts toward points_for.
            new_stats.append(build_row(m.teamAId, None, m.teamAScore, None, None))
        else:
            result_a = "W" if m.teamAScore > m.teamBScore else ("L" if m.teamAScore < m.teamBScore else "D")
            result_b = "L" if result_a == "W" else ("W" if result_a == "L" else "D")
            new_stats.append(build_row(m.teamAId, m.teamBId, m.teamAScore, m.teamBScore, result_a))
            new_stats.append(build_row(m.teamBId, m.teamAId, m.teamBScore, m.teamAScore, result_b))

    sorted_stats = sorted(new_stats, key=lambda s: (-s["total_points"], -s["points_for"]))
    rank_map = {s["team_id"]: i + 1 for i, s in enumerate(sorted_stats)}

    rows = [
        {
            "team_id": s["team_id"],
            "gameweek": body.gameweek,
            "rank": rank_map[s["team_id"]],
            "opponent_id": s["opponent_id"],
            "total_points": s["total_points"],
            "wins": s["wins"],
            "draws": s["draws"],
            "losses": s["losses"],
            "points_for": s["points_for"],
            "points_against": s["points_against"],
        }
        for s in new_stats
    ]

    try:
        client.table("team_stats").insert(rows).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to insert gameweek data")

    return {"success": True}


@app.get("/api/bluebaycup/admin/season/{season_id}")
def get_season(season_id: int, username: str = Depends(require_admin)):
    client = admin_client()

    try:
        season_result = (
            client.table("seasons")
            .select("season_id, year, prize_pool, high_score_prize, league_api_id")
            .eq("season_id", season_id)
            .single()
            .execute()
        )
        season = season_result.data
    except Exception:
        raise HTTPException(status_code=404, detail="Season not found")

    try:
        teams_result = (
            client.table("teams")
            .select("team_id, team_name, player_id, api_entry_id, draft_pick, players(name)")
            .eq("season_id", season_id)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch teams")

    teams = [
        {
            "team_id": t["team_id"],
            "team_name": t["team_name"],
            "player_id": t["player_id"],
            "player_name": (t.get("players") or {}).get("name", ""),
            "api_entry_id": t["api_entry_id"],
            "draft_pick": t["draft_pick"],
        }
        for t in teams_result.data
    ]

    return {"season": season, "teams": teams}


@app.delete("/api/bluebaycup/admin/season/{season_id}")
def delete_season(season_id: int, username: str = Depends(require_admin)):
    client = admin_client()

    teams_result = client.table("teams").select("team_id").eq("season_id", season_id).execute()
    team_ids = [t["team_id"] for t in teams_result.data]

    if team_ids:
        client.table("team_stats").delete().in_("team_id", team_ids).execute()
        client.table("teams").delete().in_("team_id", team_ids).execute()

    try:
        client.table("seasons").delete().eq("season_id", season_id).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete season")

    return {"success": True}


@app.patch("/api/bluebaycup/admin/season/{season_id}")
def update_season(season_id: int, body: SeasonUpdateBody, username: str = Depends(require_admin)):
    client = admin_client()
    try:
        client.table("seasons").update(
            {
                "year": body.year,
                "prize_pool": body.prizePool,
                "high_score_prize": body.highScorePrize,
                "league_api_id": body.league_api_id,
            }
        ).eq("season_id", season_id).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update season")

    return {"success": True}


@app.patch("/api/bluebaycup/admin/teams/{team_id}")
def update_team(team_id: int, body: TeamUpdateBody, username: str = Depends(require_admin)):
    client = admin_client()
    try:
        client.table("teams").update(
            {"api_entry_id": body.api_entry_id, "draft_pick": body.draft_pick}
        ).eq("team_id", team_id).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update team")

    return {"success": True}
