'use client'

import React from 'react'
import { PlayerOverallStats } from './types'

interface OverallTableProps {
  data: PlayerOverallStats[];
}

export default function OverallTable({ data }: OverallTableProps) {
  const formatMedalValue = (value: number, color: string) => {
    if (value === 0) return '-'
    return value
  }

  const getMedalColor = (value: number, type: 'gold' | 'silver' | 'bronze') => {
    if (value === 0) return 'text-gray-400'
    
    switch (type) {
      case 'gold':
        return 'text-yellow-500 font-bold'
      case 'silver':
        return 'text-gray-400 font-bold'
      case 'bronze':
        return 'text-amber-700 font-bold'
      default:
        return 'text-gray-700'
    }
  }

  return (
    <div className="w-full overflow-x-auto rounded-2xl shadow-2xl border border-gray-200">
      <table className="min-w-full bg-white">
        <thead className="bg-linear-to-r from-blue-600 to-purple-600 text-white">
          <tr>
            <th className="py-4 px-6 text-left font-bold text-sm uppercase tracking-wider whitespace-nowrap">Rank</th>
            <th className="py-4 px-6 text-left font-bold text-sm uppercase tracking-wider whitespace-nowrap">Player</th>
            <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider whitespace-nowrap">Seasons</th>
            <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider whitespace-nowrap">🥇</th>
            <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider whitespace-nowrap">🥈</th>
            <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider whitespace-nowrap">🥉</th>
            <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider whitespace-nowrap">Avg. Points</th>
            <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider whitespace-nowrap">Avg. PF</th>
            <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider whitespace-nowrap">Avg. PA</th>
            <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider whitespace-nowrap">Prize Money</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((player, index) => (
            <tr
              key={player.playerId}
              className={`transition-all duration-150 hover:bg-blue-50 hover:shadow-md ${
                index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
              }`}
            >
              <td className="py-4 px-6 font-bold text-xl text-blue-600">{player.rank}</td>
              <td className="py-4 px-6 font-bold text-gray-900 text-lg">{player.playerName}</td>
              <td className="py-4 px-6 text-center font-semibold text-gray-700">{player.appearances}</td>
              <td className={`py-4 px-6 text-center text-xl ${getMedalColor(player.goldMedals, 'gold')}`}>
                {formatMedalValue(player.goldMedals, 'gold')}
              </td>
              <td className={`py-4 px-6 text-center text-xl ${getMedalColor(player.silverMedals, 'silver')}`}>
                {formatMedalValue(player.silverMedals, 'silver')}
              </td>
              <td className={`py-4 px-6 text-center text-xl ${getMedalColor(player.bronzeMedals, 'bronze')}`}>
                {formatMedalValue(player.bronzeMedals, 'bronze')}
              </td>
              <td className="py-4 px-6 text-center font-bold text-lg text-gray-900">
                {player.avgPointsTotal.toFixed(1)}
              </td>
              <td className="py-4 px-6 text-center text-gray-700">
                {player.avgPointsFor.toFixed(1)}
              </td>
              <td className="py-4 px-6 text-center text-gray-700">
                {player.avgPointsAgainst.toFixed(1)}
              </td>
              <td className="py-4 px-6 text-center font-bold text-green-600">
                ${player.totPrizeMoney.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
