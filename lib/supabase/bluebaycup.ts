import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types matching your schema
export interface Player {
  player_id: number;
  name: string;
}

export interface Season {
  season_id: number;
  year: string;
  prize_pool: number;
}

export interface Team {
  team_id: number;
  player_id: number;
  season_id: number;
  team_name: string;
}

export interface TeamStats {
  team_id: number;
  gameweek: number;
  rank: number;
  total_points: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
}
