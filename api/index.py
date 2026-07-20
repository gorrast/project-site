import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import List, Literal, Optional

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


class SeasonCreateBody(BaseModel):
    year: str
    prizePool: float
    highScorePrize: Optional[float] = 0
    participants: List[Participant]


class SeasonUpdateBody(BaseModel):
    year: str
    prizePool: float
    highScorePrize: float


class TeamEntry(BaseModel):
    teamId: int
    pointsFor: float
    pointsAgainst: float
    result: Literal["W", "D", "L"]


class GameweekBody(BaseModel):
    seasonId: int
    gameweek: int
    entries: List[TeamEntry]


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
        .select("season_id, year, prize_pool, high_score_prize")
        .order("season_id", desc=True)
        .execute()
        .data
    )
    teams = client.table("teams").select("team_id, player_id, season_id").execute().data
    final_stats = (
        client.table("team_stats")
        .select("team_id, total_points, points_for, points_against, teams(season_id)")
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
        {"overallStats": overall_stats, "seasons": formatted_seasons, "latestSeason": latest_season},
        headers={"Cache-Control": "public, max-age=3600"},
    )


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
                    {"gameweek": gw, "rank": None, "totalPoints": 0, "pointsFor": 0, "pointsAgainst": 0}
                )
                continue
            gw_stats = [s for s in all_stats if s["gameweek"] == gw]
            sorted_gw = sorted(gw_stats, key=lambda s: -s["total_points"])
            rank = next(i for i, s in enumerate(sorted_gw) if s["team_id"] == team["team_id"]) + 1
            gameweek_data.append(
                {
                    "gameweek": gw,
                    "rank": rank,
                    "totalPoints": stat["total_points"],
                    "pointsFor": stat["points_for"],
                    "pointsAgainst": stat["points_against"],
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


@app.get("/api/bluebaycup/admin/season")
def list_seasons(username: str = Depends(require_admin)):
    client = admin_client()
    try:
        result = (
            client.table("seasons")
            .select("season_id, year, prize_pool, high_score_prize")
            .order("season_id", desc=True)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch seasons")
    return {"seasons": result.data}


@app.post("/api/bluebaycup/admin/season")
def create_season(body: SeasonCreateBody, username: str = Depends(require_admin)):
    if not body.year or body.prizePool is None or not body.participants:
        raise HTTPException(status_code=400, detail="year, prizePool, and participants are required")

    client = admin_client()

    try:
        season_result = (
            client.table("seasons")
            .insert(
                {
                    "year": body.year,
                    "prize_pool": body.prizePool,
                    "high_score_prize": body.highScorePrize or 0,
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
            resolved_participants.append({"player_id": p.playerId, "teamName": p.teamName})
        else:
            name = (p.playerName or "").strip()
            if not name:
                raise HTTPException(status_code=400, detail="Missing name for new player")
            try:
                new_player_result = client.table("players").insert({"name": name}).execute()
                new_player = new_player_result.data[0]
            except Exception:
                raise HTTPException(status_code=500, detail=f"Failed to create player: {p.playerName}")
            resolved_participants.append({"player_id": new_player["player_id"], "teamName": p.teamName})

    teams_to_insert = [
        {"player_id": p["player_id"], "season_id": season["season_id"], "team_name": p["teamName"]}
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
    if not body.seasonId or body.gameweek is None or not body.entries:
        raise HTTPException(status_code=400, detail="seasonId, gameweek, and entries are required")

    if body.gameweek < 0 or body.gameweek > 38:
        raise HTTPException(status_code=400, detail="Gameweek must be a whole number between 0 and 38")

    client = admin_client()
    team_ids = [e.teamId for e in body.entries]

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

    new_stats = []
    for entry in body.entries:
        prev = prev_stats.get(
            entry.teamId,
            {"total_points": 0, "wins": 0, "draws": 0, "losses": 0, "points_for": 0, "points_against": 0},
        )
        wins_this_week = 1 if entry.result == "W" else 0
        draws_this_week = 1 if entry.result == "D" else 0
        losses_this_week = 1 if entry.result == "L" else 0
        league_points_this_week = 3 if entry.result == "W" else (1 if entry.result == "D" else 0)

        new_stats.append(
            {
                "team_id": entry.teamId,
                "total_points": prev["total_points"] + league_points_this_week,
                "wins": prev["wins"] + wins_this_week,
                "draws": prev["draws"] + draws_this_week,
                "losses": prev["losses"] + losses_this_week,
                "points_for": prev["points_for"] + entry.pointsFor,
                "points_against": prev["points_against"] + entry.pointsAgainst,
            }
        )

    sorted_stats = sorted(new_stats, key=lambda s: (-s["total_points"], -s["points_for"]))
    rank_map = {s["team_id"]: i + 1 for i, s in enumerate(sorted_stats)}

    rows = [
        {
            "team_id": s["team_id"],
            "gameweek": body.gameweek,
            "rank": rank_map[s["team_id"]],
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
            .select("season_id, year, prize_pool, high_score_prize")
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
            .select("team_id, team_name, player_id, players(name)")
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
            {"year": body.year, "prize_pool": body.prizePool, "high_score_prize": body.highScorePrize}
        ).eq("season_id", season_id).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update season")

    return {"success": True}
