'use client'

import React from 'react'
import SeasonTable from './SeasonTable'
import PerformanceChart from './PerformanceChart'
import TeamGameweekBreakdown from './TeamGameweekBreakdown'
import SectionSkeleton from './SectionSkeleton'
import { PlayerSeasonStats, PlayerProgressData, HighScoreData } from './types'

interface SeasonViewProps {
  seasonName: string
  seasonData: PlayerSeasonStats[]
  progressData: PlayerProgressData[]
  highScoreData: HighScoreData | null
  isLoading: boolean
}

export default function SeasonView({ seasonName, seasonData, progressData, highScoreData, isLoading }: SeasonViewProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-16">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-16">
      <section>
        <SeasonTable data={seasonData} seasonName={seasonName} />
        {highScoreData && (
          <div className="mt-4 flex flex-col items-center gap-1 px-12 py-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-center mx-auto w-fit min-w-64">
            <span className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Highest GW Score
            </span>
            <span className="font-heading text-2xl font-extrabold text-gray-900 dark:text-gray-100">{highScoreData.playerName}</span>
            <span className="text-base font-medium text-gray-700 dark:text-gray-300">
              <span className="font-bold text-amber-600 dark:text-amber-400">{highScoreData.score}</span> points in{' '}
              <span className="font-bold text-amber-600 dark:text-amber-400">GW{highScoreData.gameweek}</span>
            </span>
          </div>
        )}
      </section>

      {progressData.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Performance Over Time</h2>
          <PerformanceChart playersData={progressData} seasonName={seasonName} />
        </section>
      )}

      {progressData.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Team Gameweek Breakdown</h2>
          <TeamGameweekBreakdown playersData={progressData} />
        </section>
      )}
    </div>
  )
}
