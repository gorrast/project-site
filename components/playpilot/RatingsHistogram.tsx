'use client'

import React, { useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useReducedMotion } from 'motion/react'
import { ChartContainer } from '@/components/ui/chart'
import { PlayPilotRating } from './types'

interface RatingsHistogramProps {
  ratings: PlayPilotRating[]
  selectedRating: number | null
  onSelectRating: (score: number) => void
}

const Y_AXIS_WIDTH = 36

export default function RatingsHistogram({ ratings, selectedRating, onSelectRating }: RatingsHistogramProps) {
  // The readout follows the hovered bar and falls back to the selected one.
  const [hovered, setHovered] = useState<number | null>(null)
  const reduced = useReducedMotion()

  const counts = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 }))
  ratings.forEach(({ score }) => {
    const bucket = counts[Math.round(score) - 1]
    if (bucket) bucket.count += 1
  })

  const total = ratings.length
  const average = total > 0 ? ratings.reduce((sum, r) => sum + r.score, 0) / total : null
  const shownScore = hovered ?? selectedRating
  const shown = shownScore !== null ? counts[shownScore - 1] : null

  const follow = (state: { isTooltipActive: boolean; activeTooltipIndex?: number | string | null }) =>
    setHovered(state.isTooltipActive && state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) + 1 : null)

  return (
    <div className="rounded-2xl border border-line bg-surface py-5 pr-4 pl-1 sm:pr-6 sm:pl-3">
      <div
        className="mb-3.5 flex min-h-8 flex-wrap items-center gap-x-3.5 gap-y-2 text-sm"
        style={{ marginLeft: Y_AXIS_WIDTH + 10 }}
        aria-live="polite"
      >
        {shown ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-accent" />
              Rating <span className="font-mono font-medium tabular-nums">{shown.score}</span>
            </span>
            <span className="text-ink-2">
              <span className="font-mono font-medium text-ink tabular-nums">{shown.count}</span> titles
            </span>
            <span className="font-mono text-ink-3 tabular-nums">
              {total > 0 ? ((shown.count / total) * 100).toFixed(1) : '–'}%
            </span>
          </>
        ) : (
          <span className="text-ink-2">
            <span className="font-mono font-medium text-ink tabular-nums">{total}</span> titles · average{' '}
            <span className="font-mono font-medium text-ink tabular-nums">{average?.toFixed(2) ?? '–'}</span>
          </span>
        )}
      </div>
      <ChartContainer config={{}} className="block h-[clamp(240px,32vw,320px)] w-full aspect-auto">
        <BarChart
          data={counts}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          onMouseMove={follow}
          onTouchMove={follow}
          onMouseLeave={() => setHovered(null)}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="score" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={Y_AXIS_WIDTH} allowDecimals={false} />
          {/* No floating panel: the readout above replaces it. */}
          <Tooltip content={() => null} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar
            dataKey="count"
            radius={[2, 2, 0, 0]}
            cursor="pointer"
            onClick={entry => onSelectRating(Number(entry.payload.score))}
            isAnimationActive={!reduced}
            animationDuration={600}
            animationEasing="ease-out"
          >
            {counts.map(entry => (
              <Cell
                key={entry.score}
                fill="var(--accent)"
                fillOpacity={selectedRating === null || selectedRating === entry.score ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="mt-3 text-center text-xs text-ink-3">Pick a bar to list only the titles with that rating.</p>
    </div>
  )
}
