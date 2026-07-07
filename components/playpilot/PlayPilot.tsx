'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import RatingsHistogram from './RatingsHistogram'
import { PlayPilotRatingsResponse } from './types'
import type { ResolveProfileRetryInfo } from '@/lib/playpilot/resolveProfile'

export default function PlayPilot() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlayPilotRatingsResponse | null>(null)
  const [retry, setRetry] = useState<ResolveProfileRetryInfo | null>(null)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  async function handleGenerate() {
    const trimmed = username.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setData(null)
    setRetry(null)
    setCountdown(0)

    try {
      const res = await fetch(`/api/playpilot/ratings?username=${encodeURIComponent(trimmed)}`)

      if (!res.body) {
        throw new Error('Failed to fetch ratings')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let separatorIndex = buffer.indexOf('\n\n')
        while (separatorIndex !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex)
          buffer = buffer.slice(separatorIndex + 2)
          separatorIndex = buffer.indexOf('\n\n')

          if (!rawEvent.startsWith('data: ')) continue
          const event = JSON.parse(rawEvent.slice('data: '.length))

          if (event.type === 'retry') {
            setRetry(event)
            setCountdown(Math.round(event.waitMs / 1000))
          } else if (event.type === 'done') {
            setData(event as PlayPilotRatingsResponse)
          } else if (event.type === 'error') {
            setError(event.error)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ratings')
    } finally {
      setLoading(false)
      setRetry(null)
      setCountdown(0)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">PlayPilot</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          placeholder="PlayPilot username (e.g. benjaminsten)"
          className="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button onClick={handleGenerate} disabled={loading || !username.trim()}>
          {loading ? 'Generating…' : 'Generate'}
        </Button>
      </div>

      {loading && retry && (
        <p className="text-sm text-muted-foreground mb-4">
          Attempt {retry.attempt}/{retry.maxAttempts} failed (HTTP {retry.status}). Retrying
          {countdown > 0 ? ` in ${countdown}s…` : '…'}
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}

      {data && (
        data.ratings.length > 0 ? (
          <RatingsHistogram ratings={data.ratings} username={data.username} />
        ) : (
          <p className="text-sm text-muted-foreground">No ratings found for this profile.</p>
        )
      )}
    </div>
  )
}
