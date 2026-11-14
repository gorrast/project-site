'use client'

import React, { useState } from 'react'
import { RevealSection } from '@/components/ui/Motion'
import { SectionHeading } from '@/components/SectionHeading'
import SeasonTable from './SeasonTable'
import PerformanceChart from './PerformanceChart'
import TeamGameweekBreakdown from './TeamGameweekBreakdown'
import SectionSkeleton from './SectionSkeleton'
import { Season, SeasonStats, TOTAL_GAMEWEEKS } from './types'

interface SeasonViewProps {
  season: Season
  /** Undefined while the season is loading. */
  stats: SeasonStats | undefined
}

export default function SeasonView({ season, stats }: SeasonViewProps) {
  // One selected manager for the table, the chips and the match-by-match chart.
  // Kept across season switches; falls back to the leader.
  const [selectedId, setSelectedId] = useState('')

  if (!stats) {
    return (
      <div className="flex flex-col gap-20">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    )
  }

  const { standings, progressData, highScoreData, maxGameweek } = stats
  const focusId = standings.some(p => p.playerId === selectedId) ? selectedId : (standings[0]?.playerId ?? '')
  // The oldest season only has its final totals on record.
  const hasGameweeks = progressData.some(p => p.gameweeks.length > 1)

  const caption = !hasGameweeks
    ? 'Final standings. Only season totals were recorded, so there are no gameweek charts.'
    : season.isFinished
      ? `Final standings after ${maxGameweek} gameweeks. Select a row to follow that manager in the charts.`
      : `Gameweek ${maxGameweek} of ${TOTAL_GAMEWEEKS}. Select a row to follow that manager in the charts.`

  return (
    <div className="flex flex-col gap-20">
      <section>
        <SectionHeading title={`${season.seasonName} standings`} caption={caption}>
          {hasGameweeks && highScoreData && (
            <div className="flex flex-col gap-1 sm:items-end">
              <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Highest gameweek</span>
              <span className="text-sm text-ink-2">
                <span className="font-mono text-xl font-medium text-ink tabular-nums">{highScoreData.score}</span> pts ·{' '}
                {highScoreData.playerName} · GW {highScoreData.gameweek}
              </span>
            </div>
          )}
        </SectionHeading>
        <SeasonTable data={standings} focusId={focusId} onFocus={setSelectedId} />
      </section>

      {hasGameweeks && (
        <RevealSection>
          <PerformanceChart
            playersData={progressData}
            scope={`${season.seasonName}, all ${progressData.length} managers${season.isFinished ? '' : ` after GW ${maxGameweek}`}.`}
          />
        </RevealSection>
      )}

      {hasGameweeks && (
        <RevealSection>
          <TeamGameweekBreakdown playersData={progressData} standings={standings} focusId={focusId} onFocus={setSelectedId} />
        </RevealSection>
      )}
    </div>
  )
}
