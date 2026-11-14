'use client'

import React from 'react'
import { motion } from 'motion/react'
import { MetricGroup, quietItemProps } from '@/components/ui/Motion'
import { TrophySeasonEntry } from './types'

interface TrophyHistoryProps {
  /** Newest first, as the API returns it. */
  trophyHistory: TrophySeasonEntry[]
}

/** Past champions: one card per finished season. */
export default function TrophyHistory({ trophyHistory }: TrophyHistoryProps) {
  return (
    <MetricGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
      {trophyHistory.map(entry => (
        <motion.div
          key={entry.seasonId}
          {...quietItemProps}
          className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-line bg-surface px-[22px] pt-[22px] pb-5"
        >
          <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink-3">
            <span className="tracking-[0.08em] uppercase">{entry.seasonName}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-gold" />
              Champion
            </span>
          </div>
          <div className="font-display text-2xl leading-[1.15] font-semibold tracking-[-0.02em]">{entry.winner.playerName}</div>
          <div className="text-[13px] leading-normal text-ink-2">
            {entry.winner.points} pts
            {entry.runnerUp &&
              (entry.margin
                ? `, ${entry.margin} clear of ${entry.runnerUp.playerName}`
                : `, level on points with ${entry.runnerUp.playerName}`)}
            {entry.third && <span className="block text-ink-3">3rd {entry.third.playerName}</span>}
          </div>
        </motion.div>
      ))}
    </MetricGroup>
  )
}
