import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client'
import { hashPassword, signSessionToken, ADMIN_COOKIE } from '@/lib/admin-auth'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('admin_credentials')
      .select('username, password_hash, salt')
      .eq('username', username)
      .single()

    if (error || !data) {
      // Always do hash work to avoid timing-based username enumeration
      hashPassword(password, crypto.randomBytes(16).toString('hex'))
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const inputHash = hashPassword(password, data.salt)
    const match = crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(data.password_hash, 'hex')
    )

    if (!match) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = signSessionToken(username)
    const response = NextResponse.json({ success: true })
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
