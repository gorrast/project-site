// Field names mirror the FastAPI JSON response as-is (snake_case) — see
// docs/frontend-handoff.md's stated convention of not translating to
// camelCase at the API boundary.

export interface FplPlayer {
  code: number
  name: string
  team: string
  position: string
  xpts_mean: number | null
  adjusted_xpts: number | null
  chance_of_playing: number | null
}

export interface TeamRosterResponse {
  team_id: number
  gw_used: number
  predictions_available: boolean
  starting_xi: FplPlayer[]
  bench: FplPlayer[]
  total_adjusted_xpts: number | null
}

export interface LeagueTeam {
  team_id: number
  name: string
}

export interface ScheduleEntry {
  team_id: number
  opponent_team_id: number
  finished: boolean
}

export interface LeagueResponse {
  league_id: number
  upcoming_gw: number
  teams: LeagueTeam[]
  schedule: ScheduleEntry[]
}

export interface PlayersPlayer extends FplPlayer {
  available: boolean
}

export interface PlayersResponse {
  predictions_available: boolean
  players: PlayersPlayer[]
}
