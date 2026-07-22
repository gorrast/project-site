'use client'

import React, { useState } from 'react'
import { FormRow } from './FormChip'
import { HeadToHeadData } from './types'

interface HeadToHeadProps {
  headToHead: HeadToHeadData
  players: { playerId: string; playerName: string }[]
}

export default function HeadToHead({ headToHead, players }: HeadToHeadProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(players[0]?.playerId ?? '')

  if (players.length === 0) return null

  const activePlayerId = players.some(p => p.playerId === selectedPlayerId) ? selectedPlayerId : players[0].playerId
  const opponents = headToHead[activePlayerId] ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {players.map(p => (
          <button
            key={p.playerId}
            type="button"
            onClick={() => setSelectedPlayerId(p.playerId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activePlayerId === p.playerId
                ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {p.playerName}
          </button>
        ))}
      </div>

      {opponents.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No recorded matches yet.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {opponents.map(o => (
            <div key={o.opponentPlayerId} className="flex items-center gap-4 p-4 flex-wrap">
              <span className="flex-1 min-w-[100px] font-semibold text-gray-900 dark:text-gray-100">
                {o.opponentPlayerName}
              </span>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {o.wins}-{o.draws}-{o.losses}
              </span>
              <span className={`w-14 shrink-0 text-right font-bold text-sm ${o.winPct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                {o.winPct.toFixed(1)}%
              </span>
              <FormRow
                entries={o.form.map(f => ({
                  result: f.result,
                  title: `${f.result} (${f.myScore}-${f.oppScore}) — GW${f.gameweek}`,
                }))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
