'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import RatingsHistogram from './RatingsHistogram'
import { PlayPilotRatingsResponse } from './types'

export default function PlayPilot() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlayPilotRatingsResponse | null>(null)

  async function handleGenerate() {
    const trimmed = username.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch(`/api/playpilot/ratings?username=${encodeURIComponent(trimmed)}`)
      const body = await res.json()

      if (!res.ok) {
        throw new Error(body.error ?? 'Failed to fetch ratings')
      }

      setData(body as PlayPilotRatingsResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ratings')
    } finally {
      setLoading(false)
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
