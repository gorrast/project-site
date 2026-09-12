import logging
import sys
from datetime import datetime, timezone

import pandas as pd

from config import CURRENT_SEASON, PREDICTION_HORIZON_GAMEWEEKS
from feature_utils import (
    FORM_SPECS,
    add_shifted_form_features,
    build_odds_by_key,
    get_upcoming_fixtures,
    latest_form_snapshot,
    orient_team_odds,
)
from sync_current_season import BOOTSTRAP_URL, get_json
from supabase_client import admin_client, fetch_all_rows, upsert_in_batches

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("compute_features")

EMPTY_FORM = {col: None for col, _, _ in FORM_SPECS}


def build_played_feature_rows(df: pd.DataFrame, odds_by_key: dict) -> list[dict]:
    """Part (a): recompute already-played current-season fixtures.
    chance_of_playing is intentionally omitted from every row here -- a
    merge-duplicates upsert (postgrest-py's default) only touches columns
    present in the payload, so an existing value on an already-played fixture
    is left untouched, while a genuinely new row still gets NULL there."""
    rows = []
    current = df[df["season"] == CURRENT_SEASON]
    for _, row in current.iterrows():
        odds = orient_team_odds(odds_by_key, row["season"], row["gw"], row["team"], row["opponent_team"], row["was_home"])
        form_values = {col: (None if pd.isna(row[col]) else float(row[col])) for col, _, _ in FORM_SPECS}
        rows.append(
            {
                "player_id": int(row["player_id"]),
                "season": row["season"],
                "gw": int(row["gw"]),
                "fixture": int(row["fixture"]),
                "position": row["position"],
                "fixtures_this_gw": int(row["fixtures_this_gw"]),
                "gameweeks_ahead": 0,
                "was_home": row["was_home"],
                "opponent_team": row["opponent_team"],
                **odds,
                **form_values,
                "target_points": None if pd.isna(row["total_points"]) else int(row["total_points"]),
            }
        )
    return rows


def build_predict_rows(
    players: list[dict],
    unfinished_gws: list[int],
    teams_by_id: dict[int, str],
    name_to_id: dict[str, int],
    chance_of_playing_by_player: dict[int, int | None],
    form_snapshot: dict[int, dict[str, float | None]],
    odds_by_key: dict,
    now: datetime,
) -> list[dict]:
    """Part (b): construct predict-rows for gameweeks_ahead = 1..len(unfinished_gws).
    Identical logic at every offset -- only the target gameweek and (for
    offset 1) the chance_of_playing snapshot differ."""
    resolved_players = []
    for player in players:
        team_id = name_to_id.get(player["current_team"])
        if team_id is None:
            # Expected for players who've left the Premier League entirely since
            # they last appeared in bootstrap-static (e.g. a relegated club) --
            # there's no current fixture list to build a predict-row from.
            log.info("Player %s: current_team '%s' not in this season's teams -- no predict-rows", player["code"], player["current_team"])
            continue
        resolved_players.append((player, team_id))

    rows = []
    for offset, gw in enumerate(unfinished_gws, start=1):
        upcoming = get_upcoming_fixtures(gw, now)
        team_fixtures: dict[int, list[dict]] = {}
        for f in upcoming:
            team_fixtures.setdefault(f["team_h"], []).append(f)
            team_fixtures.setdefault(f["team_a"], []).append(f)

        for player, team_id in resolved_players:
            player_id = player["code"]
            fixtures_for_team = team_fixtures.get(team_id, [])
            if not fixtures_for_team:
                continue  # blank gameweek at this offset for this player's team

            form_values = form_snapshot.get(player_id, EMPTY_FORM)
            chance_of_playing = chance_of_playing_by_player.get(player_id) if offset == 1 else None

            for fixture in fixtures_for_team:
                was_home = fixture["team_h"] == team_id
                opponent_id = fixture["team_a"] if was_home else fixture["team_h"]
                opponent_team = teams_by_id.get(opponent_id)
                odds = orient_team_odds(odds_by_key, CURRENT_SEASON, gw, teams_by_id.get(team_id), opponent_team, was_home)

                rows.append(
                    {
                        "player_id": player_id,
                        "season": CURRENT_SEASON,
                        "gw": gw,
                        "fixture": fixture["id"],
                        "position": player["current_position"],
                        "fixtures_this_gw": len(fixtures_for_team),
                        "gameweeks_ahead": offset,
                        "was_home": was_home,
                        "opponent_team": opponent_team,
                        **odds,
                        **form_values,
                        "chance_of_playing": chance_of_playing,
                        "target_points": None,
                    }
                )
    return rows


if __name__ == "__main__":
    log.info("Starting feature computation for %s", CURRENT_SEASON)
    now = datetime.now(timezone.utc)
    client = admin_client()

    stat_rows = fetch_all_rows(client, "raw_gameweek_stats")
    odds_rows = fetch_all_rows(client, "fixture_odds")
    odds_by_key = build_odds_by_key(odds_rows)
    log.info("Loaded %d raw_gameweek_stats rows and %d fixture_odds rows", len(stat_rows), len(odds_rows))

    df = pd.DataFrame(stat_rows)
    df["fixtures_this_gw"] = df.groupby(["player_id", "season", "gw"])["fixture"].transform("size")

    # Part (a): update this season's already-played fixtures.
    played_df = add_shifted_form_features(df)
    played_rows = build_played_feature_rows(played_df, odds_by_key)
    upsert_in_batches(client, "features", played_rows)
    log.info("Part (a): upserted %d played-fixture feature rows for %s", len(played_rows), CURRENT_SEASON)

    # Part (b): generate predict-rows for the next PREDICTION_HORIZON_GAMEWEEKS gameweeks.
    bootstrap = get_json(BOOTSTRAP_URL)
    teams_by_id = {t["id"]: t["name"] for t in bootstrap["teams"]}
    name_to_id = {name: team_id for team_id, name in teams_by_id.items()}
    # Keyed by code (not the live element id) since that's what player_id means
    # everywhere else in this script -- element ids get reassigned every season.
    chance_of_playing_by_player = {e["code"]: e.get("chance_of_playing_next_round") for e in bootstrap["elements"]}
    unfinished_gws = sorted(e["id"] for e in bootstrap["events"] if not e["finished"])[:PREDICTION_HORIZON_GAMEWEEKS]
    log.info("Target gameweeks for predict-rows: %s", unfinished_gws)

    players = fetch_all_rows(client, "players")
    form_snapshot = latest_form_snapshot(df)

    # fpl.players accumulates every player ever synced, including ones who've
    # since left the Premier League entirely -- their current_team just stays
    # frozen at wherever they were last seen, which can still be a real PL
    # club (e.g. a transfer to a non-PL club leaves current_team pointing at
    # their old, still-active club). bootstrap-static's current elements list
    # is the only reliable "still in the league" signal, so filter against it
    # directly here rather than trusting fpl.players.current_team.
    current_codes = {e["code"] for e in bootstrap["elements"]}
    active_players = [p for p in players if p["code"] in current_codes]
    inactive_codes = [p["code"] for p in players if p["code"] not in current_codes]
    log.info(
        "%d of %d fpl.players rows are still in the Premier League (%d excluded from predict-row generation)",
        len(active_players), len(players), len(inactive_codes),
    )

    if inactive_codes:
        # Upsert alone never deletes -- a player who left the league keeps
        # generating fresh predict-rows forever unless already-generated ones
        # for them are explicitly purged. Safe to run every time: once a
        # player's rows are gone, this is a no-op for them from then on.
        client.schema("fpl").table("features").delete().eq("season", CURRENT_SEASON).is_(
            "target_points", "null"
        ).in_("player_id", inactive_codes).execute()
        log.info("Purged stale predict-rows for %d players no longer in the Premier League", len(inactive_codes))

    if unfinished_gws:
        predict_rows = build_predict_rows(
            active_players, unfinished_gws, teams_by_id, name_to_id, chance_of_playing_by_player, form_snapshot, odds_by_key, now
        )
        upsert_in_batches(client, "features", predict_rows)
        log.info("Part (b): upserted %d predict rows across %d gameweeks", len(predict_rows), len(unfinished_gws))
    else:
        log.info("Part (b): no unfinished gameweeks remaining -- no predict-rows to generate")

    log.info("Feature computation complete")
