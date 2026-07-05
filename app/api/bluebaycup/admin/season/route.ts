import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client'

interface Participant {
  type: 'existing' | 'new'
  playerId?: number
  playerName?: string
  teamName: string
}

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('seasons')
    .select('season_id, year, prize_pool, high_score_prize')
    .order('season_id', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 })

  return NextResponse.json({ seasons: data })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { year, prizePool, highScorePrize, participants } = await req.json() as {
      year: string
      prizePool: number
      highScorePrize: number
      participants: Participant[]
    }

    if (!year || prizePool == null || !participants?.length) {
      return NextResponse.json({ error: 'year, prizePool, and participants are required' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    // 1. Create the season
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .insert({ year, prize_pool: prizePool, high_score_prize: highScorePrize ?? 0 })
      .select('season_id')
      .single()

    if (seasonError || !season) {
      return NextResponse.json({ error: 'Failed to create season' }, { status: 500 })
    }

    // 2. Resolve player IDs (create new players where needed)
    const resolvedParticipants: Array<{ player_id: number; teamName: string }> = []

    for (const p of participants) {
      if (p.type === 'existing') {
        if (!p.playerId) return NextResponse.json({ error: 'Missing playerId for existing player' }, { status: 400 })
        resolvedParticipants.push({ player_id: p.playerId, teamName: p.teamName })
      } else {
        if (!p.playerName?.trim()) return NextResponse.json({ error: 'Missing name for new player' }, { status: 400 })
        const { data: newPlayer, error: playerError } = await supabase
          .from('players')
          .insert({ name: p.playerName.trim() })
          .select('player_id')
          .single()

        if (playerError || !newPlayer) {
          return NextResponse.json({ error: `Failed to create player: ${p.playerName}` }, { status: 500 })
        }
        resolvedParticipants.push({ player_id: newPlayer.player_id, teamName: p.teamName })
      }
    }

    // 3. Create teams, returning IDs for initial stats
    const teamsToInsert = resolvedParticipants.map(p => ({
      player_id: p.player_id,
      season_id: season.season_id,
      team_name: p.teamName,
    }))

    const { data: insertedTeams, error: teamsError } = await supabase
      .from('teams')
      .insert(teamsToInsert)
      .select('team_id')
    if (teamsError || !insertedTeams) return NextResponse.json({ error: 'Failed to create teams' }, { status: 500 })

    // 4. Insert gameweek 0 placeholder row for each team (rank=1, all stats 0)
    const initialStats = insertedTeams.map(t => ({
      team_id: t.team_id,
      gameweek: 0,
      rank: 1,
      total_points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points_for: 0,
      points_against: 0,
    }))
    await supabase.from('team_stats').insert(initialStats)

    return NextResponse.json({ success: true, seasonId: season.season_id })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
