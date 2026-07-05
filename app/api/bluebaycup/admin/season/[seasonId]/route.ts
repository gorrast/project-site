import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { seasonId } = await params
  const supabase = createAdminSupabaseClient()

  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('season_id, year, prize_pool, high_score_prize')
    .eq('season_id', parseInt(seasonId))
    .single()

  if (seasonError || !season) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('team_id, team_name, player_id, players(name)')
    .eq('season_id', parseInt(seasonId))

  if (teamsError) return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 })

  return NextResponse.json({
    season,
    teams: teams?.map(t => ({
      team_id: t.team_id,
      team_name: t.team_name,
      player_id: t.player_id,
      player_name: (t.players as unknown as { name: string } | null)?.name ?? '',
    })) ?? [],
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { seasonId } = await params
  const id = parseInt(seasonId)
  const supabase = createAdminSupabaseClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('team_id')
    .eq('season_id', id)

  const teamIds = teams?.map(t => t.team_id) ?? []

  if (teamIds.length > 0) {
    await supabase.from('team_stats').delete().in('team_id', teamIds)
    await supabase.from('teams').delete().in('team_id', teamIds)
  }

  const { error } = await supabase.from('seasons').delete().eq('season_id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete season' }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { seasonId } = await params
  const { year, prizePool, highScorePrize } = await req.json()

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('seasons')
    .update({ year, prize_pool: prizePool, high_score_prize: highScorePrize })
    .eq('season_id', parseInt(seasonId))

  if (error) return NextResponse.json({ error: 'Failed to update season' }, { status: 500 })

  return NextResponse.json({ success: true })
}
