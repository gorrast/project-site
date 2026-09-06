-- FPL project schema — reference / target structure
--
-- ⚠️ DO NOT run this file wholesale anymore. fpl.raw_gameweek_stats,
-- fpl.players, and fpl.fixture_odds now hold real backfilled data —
-- the `drop schema cascade` below would destroy it. This file exists
-- as a reference for the intended full structure (and for standing up
-- a fresh/test environment from scratch), not as a script to re-run
-- against the live project. For incremental changes, write a targeted
-- `alter table` instead and apply it directly.

drop schema if exists fpl cascade;
create schema fpl;

-- ============================================================
-- DIMENSION TABLE
-- Only what's genuinely stable about a player. current_team/
-- current_position are for UI/decision-layer display only — never
-- join historical rows against these.
-- ============================================================
create table fpl.players (
  id bigint primary key,               -- FPL 'element' id
  name text not null,
  current_team text not null,
  current_position text not null
);

-- ============================================================
-- FACT TABLE: raw_gameweek_stats
-- Grain is PER FIXTURE. A double gameweek puts two rows under the
-- same (player, gw) with different `fixture` values — this is why
-- fixture, not gw, is part of the key.
-- Columns absent in older seasons (defensive contribution stats
-- predate ~2025-26) are null by design; LightGBM handles this natively.
-- ============================================================
create table fpl.raw_gameweek_stats (
  player_id bigint references fpl.players(id),
  season text not null,
  gw int not null,                     -- which gameweek this fixture belongs to (not unique alone)
  fixture bigint not null,             -- unique match id within a season; the true grain of this table
  team text,                           -- player's team for THIS fixture
  position text,                       -- player's position for THIS fixture
  opponent_team text,                  -- text: FPL's numeric team ids are reassigned each season
  was_home boolean,
  total_points int,                    -- points scored in this single fixture
  minutes int,
  starts boolean,
  goals_scored int,
  assists int,
  clean_sheets boolean,
  bonus int,
  saves int,
  expected_goals numeric,
  expected_assists numeric,
  expected_goal_involvements numeric,
  expected_goals_conceded numeric,
  ict_index numeric,                   -- informational composite; NOT what drives bonus points (bps is)
  bps int,
  clearances_blocks_interceptions int, -- defensive-contribution mechanic (2025-26+)
  defensive_contribution int,
  recoveries int,
  tackles int,
  primary key (player_id, season, fixture)
);

create index idx_raw_gameweek_stats_pgw on fpl.raw_gameweek_stats (player_id, season, gw);

-- ============================================================
-- FACT TABLE: fixture_odds
-- One row per fixture side per gameweek. A double-gameweek team
-- naturally gets two rows here too (different opponents), no key
-- collision.
-- ============================================================
create table fpl.fixture_odds (
  season text not null,
  gw int not null,
  team_h text not null,
  team_a text not null,
  home_win_prob numeric,               -- normalized to remove bookmaker overround
  draw_prob numeric,
  away_win_prob numeric,
  implied_total_goals numeric,
  updated_at timestamptz default now(),
  primary key (season, gw, team_h, team_a)
);

-- ============================================================
-- MATERIALIZED FEATURES
-- Grain matches raw_gameweek_stats: one row per fixture, not per
-- gameweek. This means was_home/opponent_team/odds columns are
-- always unambiguous (single fixture = single answer), and rolling
-- form windows are computed over the last N fixtures, not calendar
-- gameweeks — a slightly higher-fidelity notion of "recent form."
-- target_points is null for the upcoming, not-yet-played fixture:
-- that's the row to feed to model.predict().
-- ============================================================
create table fpl.features (
  player_id bigint references fpl.players(id),
  season text not null,
  gw int not null,
  fixture bigint not null,
  position text not null,              -- from raw_gameweek_stats, not players
  fixtures_this_gw int,                -- 1 normally, 2 on a double gameweek — a rotation-risk signal, not a grain fix
  gameweeks_ahead int,                  -- 0 for played fixtures (historical or already-happened); 1..N for forward predict-rows, where 1 = the very next gameweek
                                        -- (added after initial backfill via: alter table fpl.features add column gameweeks_ahead int;)
  was_home boolean,
  opponent_team text,
  team_win_prob numeric,
  team_draw_prob numeric,
  team_loss_prob numeric,
  implied_total_goals numeric,
  form_points_3 numeric,               -- shifted rolling mean over last N fixtures — never includes the fixture being predicted
  form_points_5 numeric,
  form_minutes_3 numeric,
  form_minutes_5 numeric,
  start_rate_5 numeric,
  form_xgi_5 numeric,
  form_goals_5 numeric,
  form_assists_5 numeric,
  form_clean_sheets_5 numeric,
  form_bonus_5 numeric,
  form_defensive_contribution_5 numeric,
  form_saves_5 numeric,
  chance_of_playing numeric,           -- from FPL API's chance_of_playing_next_round
  target_points int,                   -- null = this is the row to predict, not train on
  primary key (player_id, season, fixture)
);

create index idx_features_pgw on fpl.features (player_id, season, gw);

-- ============================================================
-- SERVING TABLE — model output, fixture grain
-- xpts_mean/p10/p50/p90 describe THIS fixture only. See the
-- fpl.gameweek_predictions view below for the gameweek-level
-- rollup the decision layer and frontend actually consume.
-- ============================================================
create table fpl.predictions (
  player_id bigint references fpl.players(id),
  season text not null,
  gw int not null,
  fixture bigint not null,
  xpts_mean numeric,
  xpts_p10 numeric,
  xpts_p50 numeric,
  xpts_p90 numeric,
  created_at timestamptz default now(),
  primary key (player_id, season, fixture)
);

-- ============================================================
-- GAMEWEEK ROLLUP VIEW
-- Plain (non-materialized) view is enough at this scale — a handful
-- of rows per gameweek, recomputed on read, always consistent with
-- fpl.predictions by construction.
--
-- xpts_mean is EXACT: expectation is additive regardless of
-- correlation between a double-gameweek player's two fixtures.
--
-- The _bound columns are NOT true quantiles of the summed
-- distribution — summing quantiles isn't valid in general. They're
-- a labeled, conservative approximation (sum of P10s tends to
-- understate the real floor; sum of P90s tends to overstate the
-- real ceiling), good enough for MVP display. A rigorous version
-- needs simulation from full posterior draws — future Bayesian-phase
-- work, not now.
-- ============================================================
create view fpl.gameweek_predictions as
select
  player_id,
  season,
  gw,
  count(*) as num_fixtures,
  sum(xpts_mean) as xpts_mean,
  sum(xpts_p10) as xpts_p10_floor_bound,
  sum(xpts_p50) as xpts_p50_approx,
  sum(xpts_p90) as xpts_p90_ceiling_bound
from fpl.predictions
group by player_id, season, gw;

-- ============================================================
-- GRANTS — explicit rather than relying on Supabase's default
-- exposure behavior (see the Oct 30, 2026 grants change).
-- "ALL TABLES" in Postgres GRANT statements includes views, so
-- fpl.gameweek_predictions is covered by these too.
-- ============================================================
grant usage on schema fpl to anon, authenticated, service_role;
grant select on all tables in schema fpl to anon;
alter default privileges in schema fpl grant select on tables to anon;