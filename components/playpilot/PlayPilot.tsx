'use client'

import React, { useEffect, useMemo, useState } from 'react'
import RatingsHistogram from './RatingsHistogram'
import TitleList from './TitleList'
import { PlayPilotRatingsResponse } from './types'
import type { ResolveProfileRetryInfo } from '@/lib/playpilot/resolveProfile'

type TypeFilter = 'all' | 'movie' | 'series'

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'TV Shows' },
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
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="bg-linear-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">PlayPilot Compare</h1>
          </div>
          <p className="text-base text-gray-500 dark:text-gray-400">
            See how a PlayPilot user rates movies and TV shows.
          </p>
          <div className="mt-4 h-1 w-16 bg-linear-to-r from-blue-600 to-purple-600 mx-auto rounded-full" />
        </div>

        {/* Search card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-gray-700 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="PlayPilot username (e.g. benjaminsten)"
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 font-medium text-gray-900 dark:text-gray-100 transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500 outline-none"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !username.trim()}
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-linear-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {loading ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {loading && retry && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              Attempt {retry.attempt}/{retry.maxAttempts} failed (HTTP {retry.status}). Retrying
              {countdown > 0 ? ` in ${countdown}s…` : '…'}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>
          )}
        </div>

        {data && (
          data.ratings.length > 0 ? (
            <div className="flex flex-col gap-6">
              {data.totalRatings !== null && data.totalRatings > data.ratings.length && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center -mb-2">
                  Showing {data.ratings.length} of {data.totalRatings} rated titles
                </p>
              )}

              {/* Movie / TV toggle */}
              <div className="flex flex-wrap justify-center gap-3">
                {TYPE_FILTERS.map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => handleTypeFilterChange(filter.value)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 transform hover:scale-105 cursor-pointer ${
                      typeFilter === filter.value
                        ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {filter.label} ({typeCounts[filter.value]})
                  </button>
                ))}
              </div>

              <RatingsHistogram
                ratings={typeFiltered}
                username={data.username}
                selectedRating={selectedRating}
                onSelectRating={handleSelectRating}
              />

              <TitleList
                ratings={displayedRatings}
                selectedRating={selectedRating}
                onClearRating={() => setSelectedRating(null)}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No ratings found for this profile.</p>
          )
        )}
      </div>
    </div>
  )
}
