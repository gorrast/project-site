import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client'

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('players')
    .select('player_id, name')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })

  return NextResponse.json({ players: data })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('players')
    .insert({ name: name.trim() })
    .select('player_id, name')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create player' }, { status: 500 })

  return NextResponse.json({ player: data })
}
