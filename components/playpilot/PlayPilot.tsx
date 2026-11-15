'use client'

import React, { useEffect, useMemo, useState } from 'react'
import RatingsHistogram from './RatingsHistogram'
import TitleList from './TitleList'
import { PlayPilotRatingsResponse } from './types'
import type { ResolveProfileRetryInfo } from '@/lib/playpilot/resolveProfile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { RevealHeading, RevealSection } from '@/components/ui/Motion'
import { SectionHeading } from '@/components/SectionHeading'

type TypeFilter = 'all' | 'movie' | 'series'

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'TV' },
]

export default function PlayPilot() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlayPilotRatingsResponse | null>(null)
  const [retry, setRetry] = useState<ResolveProfileRetryInfo | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selectedRating, setSelectedRating] = useState<number | null>(null)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  async function handleGenerate() {
    const normalized = username.toLowerCase().replace(/\s+/g, '')
    if (!normalized) return

    setLoading(true)
    setError(null)
    setData(null)
    setRetry(null)
    setCountdown(0)
    setTypeFilter('all')
    setSelectedRating(null)

    try {
      const res = await fetch(`/api/playpilot/ratings?username=${encodeURIComponent(normalized)}`)

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

  const typeFiltered = useMemo(() => {
    if (!data) return []
    if (typeFilter === 'all') return data.ratings
    return data.ratings.filter(r => r.type === typeFilter)
  }, [data, typeFilter])

  const displayedRatings = useMemo(() => {
    if (selectedRating === null) return typeFiltered
    return typeFiltered.filter(r => Math.round(r.score) === selectedRating)
  }, [typeFiltered, selectedRating])

  const typeCounts = useMemo(() => {
    if (!data) return { all: 0, movie: 0, series: 0 }
    return {
      all: data.ratings.length,
      movie: data.ratings.filter(r => r.type === 'movie').length,
      series: data.ratings.filter(r => r.type === 'series').length,
    }
  }, [data])

  function handleSelectRating(score: number) {
    setSelectedRating(prev => (prev === score ? null : score))
  }

  function handleTypeFilterChange(value: TypeFilter) {
    setTypeFilter(value)
    setSelectedRating(null)
  }

  return (
    <div className="mx-auto max-w-[1200px] px-[clamp(16px,5vw,40px)] pb-[120px]">
      <section className="flex flex-col gap-3.5 pt-[clamp(40px,8vw,72px)] pb-12">
        <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Early prototype · Film &amp; TV</div>
        <RevealHeading as="h1" className="text-[clamp(40px,9vw,60px)] leading-none font-semibold tracking-[-0.035em]">
          PlayPilot Compare
        </RevealHeading>
        <p className="max-w-[640px] text-lg leading-relaxed text-pretty text-ink-2">
          How a PlayPilot user rates films and series, from their public profile.
        </p>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={e => { e.preventDefault(); handleGenerate() }}
        >
          <label className="flex min-w-[min(100%,260px)] flex-col gap-1.5">
            <span className="text-[13px] font-medium">PlayPilot username</span>
            <Input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
          </label>
          <Button type="submit" disabled={loading || !username.trim()}>
            {loading ? 'Generating…' : 'Generate'}
          </Button>
        </form>
        {loading && (
          <p className="text-sm text-ink-3" aria-live="polite">
            {retry
              ? `Attempt ${retry.attempt} of ${retry.maxAttempts} failed (HTTP ${retry.status}). Retrying${countdown > 0 ? ` in ${countdown}s` : ''}…`
              : 'Fetching ratings…'}
          </p>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-neg">
            Couldn&apos;t load ratings: {error}. Check the username, or try again in a minute.
          </p>
        )}
      </section>

      {data && (
        data.ratings.length > 0 ? (
          <div className="flex flex-col gap-20">
            <section>
              <SectionHeading
                title="Rating distribution"
                caption={
                  data.totalRatings !== null && data.totalRatings > data.ratings.length
                    ? `${data.username}. Showing ${data.ratings.length} of ${data.totalRatings} rated titles.`
                    : `${data.username}. Every rated title on the profile.`
                }
              >
                <Segmented
                  label="Type"
                  options={TYPE_FILTERS.map(f => ({ value: f.value, label: `${f.label} · ${typeCounts[f.value]}` }))}
                  value={typeFilter}
                  onChange={handleTypeFilterChange}
                />
              </SectionHeading>
              <RatingsHistogram
                ratings={typeFiltered}
                selectedRating={selectedRating}
                onSelectRating={handleSelectRating}
              />
            </section>

            <RevealSection>
              <TitleList
                ratings={displayedRatings}
                selectedRating={selectedRating}
                onSelectRating={setSelectedRating}
              />
            </RevealSection>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-ink-3">
            {data.username} has no public ratings. Check the username, or try a profile that has rated something.
          </p>
        )
      )}
    </div>
  )
}
