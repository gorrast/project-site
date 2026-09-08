import logging
from datetime import datetime

import pandas as pd

from sync_current_season import FIXTURES_URL, get_json

log = logging.getLogger("feature_utils")

# (feature_column, source_column_in_raw_gameweek_stats, rolling_window)
FORM_SPECS: list[tuple[str, str, int]] = [
    ("form_points_3", "total_points", 3),
    ("form_points_5", "total_points", 5),
    ("form_minutes_3", "minutes", 3),
    ("form_minutes_5", "minutes", 5),
    ("start_rate_5", "starts", 5),
    ("form_xgi_5", "expected_goal_involvements", 5),
    ("form_goals_5", "goals_scored", 5),
    ("form_assists_5", "assists", 5),
    ("form_clean_sheets_5", "clean_sheets", 5),
    ("form_bonus_5", "bonus", 5),
    ("form_defensive_contribution_5", "defensive_contribution", 5),
    ("form_saves_5", "saves", 5),
]

SORT_KEY = ["player_id", "season", "gw", "fixture"]


def add_shifted_form_features(df: pd.DataFrame) -> pd.DataFrame:
    """Adds leakage-safe rolling-form columns: for each fixture, only that
    player's strictly earlier fixtures are used (shift(1) before rolling).
    A player's first fixture gets null, not zero, in every form column."""
    df = df.sort_values(SORT_KEY).copy()
    for col, source, window in FORM_SPECS:
        df[col] = df.groupby("player_id")[source].transform(
            lambda s, window=window: pd.to_numeric(s, errors="coerce").rolling(window, min_periods=1).mean().shift(1)
        )
    return df


def latest_form_snapshot(df: pd.DataFrame) -> dict[int, dict[str, float | None]]:
    """Per player, the rolling-form values a hypothetical *next* fixture would
    carry -- i.e. the same shifted value add_shifted_form_features would
    assign, computed from all of that player's already-played fixtures. Used
    for predict-rows, which are identical across every gameweeks_ahead offset
    since no new played fixtures exist between now and any of those offsets."""
    df = df.sort_values(SORT_KEY).copy()
    for col, source, window in FORM_SPECS:
        df[col] = df.groupby("player_id")[source].transform(
            lambda s, window=window: pd.to_numeric(s, errors="coerce").rolling(window, min_periods=1).mean()
        )

    snapshot: dict[int, dict[str, float | None]] = {}
    last_rows = df.groupby("player_id").tail(1)
    for _, row in last_rows.iterrows():
        snapshot[int(row["player_id"])] = {
            col: (None if pd.isna(row[col]) else float(row[col])) for col, _, _ in FORM_SPECS
        }
    return snapshot


def orient_team_odds(
    odds_by_key: dict[tuple[str, int, str, str], dict],
    season: str,
    gw: int,
    team: str | None,
    opponent_team: str | None,
    was_home: bool | None,
) -> dict[str, float | None]:
    """fixture_odds stores home_win_prob/away_win_prob from the fixture's
    perspective; re-orients them to the player's team's perspective."""
    empty = {"team_win_prob": None, "team_draw_prob": None, "team_loss_prob": None, "implied_total_goals": None}
    if team is None or opponent_team is None or was_home is None:
        return empty

    key = (season, gw, team, opponent_team) if was_home else (season, gw, opponent_team, team)
    odds = odds_by_key.get(key)
    if odds is None:
        return empty

    if was_home:
        team_win_prob, team_loss_prob = odds["home_win_prob"], odds["away_win_prob"]
    else:
        team_win_prob, team_loss_prob = odds["away_win_prob"], odds["home_win_prob"]

    return {
        "team_win_prob": team_win_prob,
        "team_draw_prob": odds["draw_prob"],
        "team_loss_prob": team_loss_prob,
        "implied_total_goals": odds["implied_total_goals"],
    }


def build_odds_by_key(odds_rows: list[dict]) -> dict[tuple[str, int, str, str], dict]:
    return {(row["season"], row["gw"], row["team_h"], row["team_a"]): row for row in odds_rows}


def get_upcoming_fixtures(gw: int, now: datetime) -> list[dict]:
    """Fixtures for `gw` that haven't kicked off yet as of `now`. Gates on each
    fixture's own kickoff_time rather than the gameweek-level `finished` flag,
    since a partially-played gameweek can still look "upcoming" as a whole.
    The single source of truth for "what counts as upcoming" -- both
    predict-row fixture resolution and the chance_of_playing snapshot for
    gameweeks_ahead=1 are gated by which players get a row out of this."""
    fixtures = get_json(FIXTURES_URL, params={"event": gw})
    upcoming = []
    for f in fixtures:
        kickoff = f.get("kickoff_time")
        if kickoff is None:
            log.warning("Fixture %s (GW%d) has no kickoff_time -- skipping", f.get("id"), gw)
            continue
        kickoff_dt = datetime.fromisoformat(kickoff.replace("Z", "+00:00"))
        if kickoff_dt <= now:
            log.warning("Fixture %s (GW%d) already kicked off at %s -- skipping", f["id"], gw, kickoff)
            continue
        upcoming.append(f)
    return upcoming
