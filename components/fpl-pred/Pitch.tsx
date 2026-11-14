'use client'

import { motion } from 'motion/react'
import type { FplPlayer, TeamRosterResponse } from './types'
import PlayerCard from './PlayerCard'
import { MetricGroup, quietItemProps } from '@/components/ui/Motion'
import { cn } from '@/lib/utils'

const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'] as const

/** FPL plays the backup keeper only for the keeper, so he heads the bench; outfielders keep the API's order. */
const benchOrder = (bench: FplPlayer[]) =>
  [...bench].sort((a, b) => Number(b.position === 'GKP') - Number(a.position === 'GKP'))

function PitchMarkings() {
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-2.5 h-[calc(100%-20px)] w-[calc(100%-20px)] text-line"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <rect x="1" y="1" width="98" height="138" rx="2" vectorEffect="non-scaling-stroke" />
        <line x1="1" y1="70" x2="99" y2="70" vectorEffect="non-scaling-stroke" />
        <circle cx="50" cy="70" r="11" vectorEffect="non-scaling-stroke" />
        <rect x="26" y="1" width="48" height="17" vectorEffect="non-scaling-stroke" />
        <rect x="26" y="122" width="48" height="17" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}

/** One team's starting XI on a flat pitch, then its bench. */
export default function Pitch({
  title,
  mine,
  data,
  loading,
  error,
}: {
  title: string
  mine: boolean
  data: TeamRosterResponse | null
  loading: boolean
  error: string | null
}) {
  const total = data?.total_adjusted_xpts

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('size-2 flex-none rounded-full', mine ? 'bg-accent' : 'bg-series-muted')} />
          <span className="truncate font-display text-lg font-semibold tracking-[-0.01em]">{title}</span>
        </span>
        {total != null && (
          <span className={cn('font-mono text-sm font-medium whitespace-nowrap', mine ? 'text-accent-text' : 'text-ink')}>
            {total.toFixed(1)} xPts
          </span>
        )}
      </div>

      {loading && <p className="border-t border-line px-5 py-4 text-sm text-ink-3">Loading roster…</p>}
      {error && <p role="alert" className="border-t border-line px-5 py-4 text-[13px] text-neg">{error}</p>}

      {data && !loading && (
        <>
          {!data.predictions_available && (
            <p className="border-t border-line px-5 py-3 text-[13px] text-ink-2">
              No predictions yet for the next gameweek, so this is the roster without points.
            </p>
          )}
          <div className="relative border-t border-line px-1.5 pt-[22px] pb-[18px]">
            <PitchMarkings />
            <MetricGroup stagger={0.08} className="relative flex flex-col gap-5">
              {POSITIONS.map(pos => (
                <motion.div key={pos} {...quietItemProps} className="flex justify-around gap-0.5">
                  {data.starting_xi.filter(p => p.position === pos).map(p => (
                    <PlayerCard key={p.code} player={p} mine={mine} />
                  ))}
                </motion.div>
              ))}
            </MetricGroup>
          </div>
          <div className="mt-auto flex flex-col gap-2.5 border-t border-line px-4 pt-3.5 pb-4">
            <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Bench · auto-sub order</span>
            <div className="flex justify-around gap-1">
              {benchOrder(data.bench).map(p => (
                <PlayerCard key={p.code} player={p} bench />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
