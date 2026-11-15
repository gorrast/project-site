'use client'

import React from 'react'
import { RevealSection } from '@/components/ui/Motion'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/SectionHeading'
import OverallTable from './OverallTable'
import HeadToHead from './HeadToHead'
import TrophyHistory from './TrophyHistory'
import { PlayerOverallStats, HeadToHeadData, TrophySeasonEntry, Season, SeasonStats, TOTAL_GAMEWEEKS } from './types'

interface AllTimeViewProps {
  overallData: PlayerOverallStats[]
  headToHead: HeadToHeadData
  trophyHistory: TrophySeasonEntry[]
  seasons: Season[]
  /** The newest season and its standings, once loaded. */
  latest: { season: Season; stats: SeasonStats } | null
  onOpenLatest: () => void
  isHeadToHeadLoading: boolean
}

export default function AllTimeView({
  overallData,
  headToHead,
  trophyHistory,
  seasons,
  latest,
  onOpenLatest,
  isHeadToHeadLoading,
}: AllTimeViewProps) {
  const players = overallData.map(p => ({ playerId: p.playerId, playerName: p.playerName }))
  const finishedCount = seasons.filter(s => s.isFinished).length
  const [leader, second] = latest?.stats.standings ?? []

  return (
    <div className="flex flex-col gap-20">
      {latest && leader && (
        <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface px-[22px] py-[18px]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-accent-text uppercase">
              <span className="size-2 rounded-full bg-accent" />
              {latest.season.seasonName} ·{' '}
              {latest.season.isFinished ? 'Final' : `GW ${latest.stats.maxGameweek} of ${TOTAL_GAMEWEEKS}`}
            </span>
            <span className="font-display text-xl font-semibold tracking-[-0.01em]">
              {leader.playerName} {latest.season.isFinished ? 'won' : 'leads'}
            </span>
            {second && (
              <span className="text-sm text-ink-2">
                {leader.totalPoints} pts,{' '}
                {leader.totalPoints > second.totalPoints
                  ? `${leader.totalPoints - second.totalPoints} ahead of ${second.playerName}`
                  : `level with ${second.playerName}`}
              </span>
            )}
          </div>
          <Button variant="secondary" size="sm" className="h-9 px-4" onClick={onOpenLatest}>
            Open this season →
          </Button>
        </section>
      )}

      <RevealSection>
        <SectionHeading
          title="Overall standings"
          caption={`${finishedCount} finished seasons. Ranked by podium points (5 for a title, 2 for 2nd, 1 for 3rd), then average points.`}
        />
        <OverallTable data={overallData} />
      </RevealSection>

      <RevealSection>
        <HeadToHead headToHead={headToHead} players={players} seasonCount={seasons.length} isLoading={isHeadToHeadLoading} />
      </RevealSection>

      {trophyHistory.length > 0 && (
        <RevealSection>
          <SectionHeading
            title="Past champions"
            caption={`Winners of the ${trophyHistory.length} finished seasons, newest first.`}
          />
          <TrophyHistory trophyHistory={trophyHistory} />
        </RevealSection>
      )}
    </div>
  )
}
