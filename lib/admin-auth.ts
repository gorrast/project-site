import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const ADMIN_COOKIE = 'admin_session'
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET
  if (!s) throw new Error('ADMIN_SESSION_SECRET is not set')
  return s
}

export function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + password).digest('hex')
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function signSessionToken(username: string): string {
  const exp = Date.now() + SESSION_DURATION_MS
  const payload = Buffer.from(JSON.stringify({ username, exp })).toString('base64url')
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifySessionToken(token: string): { username: string } | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return null
    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)

    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'ascii'), Buffer.from(expectedSig, 'ascii'))) return null

    const { username, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (Date.now() > exp) return null

    return { username }
  } catch {
    return null
  }
}

export async function requireAdminAuth(): Promise<{ ok: true; username: string } | { ok: false; response: NextResponse }> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const session = verifySessionToken(token)
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }) }
  }
  return { ok: true, username: session.username }
}
