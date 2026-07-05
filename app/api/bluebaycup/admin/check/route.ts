import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin-auth'

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response
  return NextResponse.json({ authenticated: true, username: auth.username })
}
