import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client'

interface TeamEntry {
  teamId: number
  pointsFor: number       // this week's FPL score
  pointsAgainst: number   // opponent's FPL score this week
  result: 'W' | 'D' | 'L'
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { seasonId, gameweek, entries } = await req.json() as {
      seasonId: number
      gameweek: number
      entries: TeamEntry[]
    }

    if (!seasonId || gameweek == null || !entries?.length) {
      return NextResponse.json({ error: 'seasonId, gameweek, and entries are required' }, { status: 400 })
    }

    if (!Number.isInteger(gameweek) || gameweek < 0 || gameweek > 38) {
      return NextResponse.json({ error: 'Gameweek must be a whole number between 0 and 38' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    // Prevent duplicate gameweek submissions for this season
    const teamIds = entries.map(e => e.teamId)
    const { data: existing } = await supabase
      .from('team_stats')
      .select('team_id')
      .in('team_id', teamIds)
      .eq('gameweek', gameweek)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: `Gameweek ${gameweek} data already exists for this season` }, { status: 409 })
    }

    // Fetch previous gameweek cumulative stats for each team
    const prevGameweek = gameweek - 1
    const prevStats: Record<number, { total_points: number; wins: number; draws: number; losses: number; points_for: number; points_against: number }> = {}

    if (prevGameweek > 0) {
      const { data: prev } = await supabase
        .from('team_stats')
        .select('team_id, total_points, wins, draws, losses, points_for, points_against')
        .in('team_id', teamIds)
        .eq('gameweek', prevGameweek)

      prev?.forEach(s => { prevStats[s.team_id] = s })
    }

    // Compute new cumulative values and ranks
    const newStats = entries.map(entry => {
      const prev = prevStats[entry.teamId] ?? { total_points: 0, wins: 0, draws: 0, losses: 0, points_for: 0, points_against: 0 }
      const winsThisWeek = entry.result === 'W' ? 1 : 0
      const drawsThisWeek = entry.result === 'D' ? 1 : 0
      const lossesThisWeek = entry.result === 'L' ? 1 : 0
      const leaguePointsThisWeek = entry.result === 'W' ? 3 : entry.result === 'D' ? 1 : 0

      return {
        team_id: entry.teamId,
        total_points: prev.total_points + leaguePointsThisWeek,
        wins: prev.wins + winsThisWeek,
        draws: prev.draws + drawsThisWeek,
        losses: prev.losses + lossesThisWeek,
        points_for: prev.points_for + entry.pointsFor,
        points_against: prev.points_against + entry.pointsAgainst,
      }
    })

    // Compute rank: sort by total_points desc, then points_for desc
    const sorted = [...newStats].sort((a, b) =>
      b.total_points !== a.total_points
        ? b.total_points - a.total_points
        : b.points_for - a.points_for
    )
    const rankMap: Record<number, number> = {}
    sorted.forEach((s, i) => { rankMap[s.team_id] = i + 1 })

    const rows = newStats.map(s => ({
      team_id: s.team_id,
      gameweek,
      rank: rankMap[s.team_id],
      total_points: s.total_points,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      points_for: s.points_for,
      points_against: s.points_against,
    }))

    const { error } = await supabase.from('team_stats').insert(rows)
    if (error) return NextResponse.json({ error: 'Failed to insert gameweek data' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
