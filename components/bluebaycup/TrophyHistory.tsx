'use client'

import React from 'react'
import { TrophySeasonEntry } from './types'

interface TrophyHistoryProps {
  trophyHistory: TrophySeasonEntry[]
}

export default function TrophyHistory({ trophyHistory }: TrophyHistoryProps) {
  if (trophyHistory.length === 0) return null

  return (
    <div className="flex flex-col">
      {trophyHistory.map((entry, i) => (
        <div key={entry.seasonId} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-[#eab308]" />
            {i < trophyHistory.length - 1 && <span className="flex-1 w-0.5 bg-gray-200 dark:bg-gray-700" />}
          </div>
          <div className="flex-1 pb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {entry.seasonName}
            </span>
            <div className="mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                  <span className="text-lg">🏆</span> {entry.winner.playerName}
                </span>
                <span className="font-bold text-[#eab308]">{entry.winner.points} pts</span>
              </div>
              {entry.runnerUp && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  won by {entry.margin} over {entry.runnerUp.playerName} ({entry.runnerUp.points})
                  {entry.third && <> · 3rd: {entry.third.playerName} ({entry.third.points})</>}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
