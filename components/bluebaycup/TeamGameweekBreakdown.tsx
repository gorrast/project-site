'use client'

import React, { useState } from 'react'
import ClusteredColumnChart from './ClusteredColumnChart'
import { PlayerProgressData } from './types'

interface TeamGameweekBreakdownProps {
  playersData: PlayerProgressData[]
}

export default function TeamGameweekBreakdown({ playersData }: TeamGameweekBreakdownProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')

  if (playersData.length === 0) return null

  const effectiveTeamId = playersData.some(p => p.teamId === selectedTeamId) ? selectedTeamId : playersData[0].teamId
  const selected = playersData.find(p => p.teamId === effectiveTeamId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {playersData.map(p => (
          <button
            key={p.teamId}
            type="button"
            onClick={() => setSelectedTeamId(p.teamId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              effectiveTeamId === p.teamId
                ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {p.playerName}
          </button>
        ))}
      </div>
      {selected && (
        <ClusteredColumnChart
          data={selected.gameweeks.map(g => ({
            gameweek: g.gameweek,
            pointsFor: g.pointsFor,
            pointsAgainst: g.pointsAgainst,
            opponentName: g.opponentName,
          }))}
          teamName={selected.playerName}
        />
      )}
    </div>
  )
}
