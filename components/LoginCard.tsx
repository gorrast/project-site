'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Centred 400px sign-in card (DESIGN.md › Per-page migration › Admin / login). */
export function LoginCard({
  eyebrow,
  title,
  endpoint,
  onLogin,
}: {
  eyebrow: string
  title: string
  /** POSTed `{ username, password }`; any 2xx counts as signed in. */
  endpoint: string
  onLogin: () => void
}) {
  const id = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) onLogin()
      else {
        const d = await res.json().catch(() => null)
        setError(d?.error ?? 'Sign-in failed. Check the username and password.')
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-[clamp(16px,4vw,24px)]">
        <div className="mb-1.5 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">{eyebrow}</div>
        <h1 className="mb-6 text-[26px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-user`} className="text-[13px] font-medium text-ink-2">Username</label>
            <Input id={`${id}-user`} type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-pass`} className="text-[13px] font-medium text-ink-2">Password</label>
            <Input id={`${id}-pass`} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && (
            <div role="alert" className="rounded-[10px] bg-[color-mix(in_srgb,var(--neg)_12%,transparent)] px-3.5 py-3 text-[13px] text-neg">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
