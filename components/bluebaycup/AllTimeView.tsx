'use client'

import React from 'react'
import OverallTable from './OverallTable'
import HeadToHead from './HeadToHead'
import TrophyHistory from './TrophyHistory'
import SectionSkeleton from './SectionSkeleton'
import { PlayerOverallStats, HeadToHeadData, TrophySeasonEntry } from './types'

interface AllTimeViewProps {
  overallData: PlayerOverallStats[]
  headToHead: HeadToHeadData
  trophyHistory: TrophySeasonEntry[]
  isLoading: boolean
}

export default function AllTimeView({ overallData, headToHead, trophyHistory, isLoading }: AllTimeViewProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-16">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    )
  }

  const players = overallData.map(p => ({ playerId: p.playerId, playerName: p.playerName }))

  return (
    <div className="flex flex-col gap-16">
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Overall Standings</h2>
        <OverallTable data={overallData} />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Head-to-Head</h2>
        <HeadToHead headToHead={headToHead} players={players} />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Trophy History</h2>
        <TrophyHistory trophyHistory={trophyHistory} />
      </section>
    </div>
  )
}
