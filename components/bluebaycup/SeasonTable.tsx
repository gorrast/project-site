'use client'

import React from 'react'
import { PlayerSeasonStats } from './types'

interface SeasonTableProps {
  data: PlayerSeasonStats[];
  seasonName: string;
}

export default function SeasonTable({ data, seasonName }: SeasonTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <h3 className="text-2xl font-bold mb-6 text-gray-900">{seasonName} Standings</h3>
      <div className="rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <table className="min-w-full bg-white">
          <thead className="bg-linear-to-r from-green-600 to-emerald-600 text-white">
            <tr>
              <th className="py-4 px-6 text-left font-bold text-sm uppercase tracking-wider">Rank</th>
              <th className="py-4 px-6 text-left font-bold text-sm uppercase tracking-wider">Player</th>
              <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider">Points</th>
              <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider">W</th>
              <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider">D</th>
              <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider">L</th>
              <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider">PF</th>
              <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider">PA</th>
              <th className="py-4 px-6 text-center font-bold text-sm uppercase tracking-wider">+/-</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((player, index) => (
              <tr
                key={player.playerId}
                className={`transition-all duration-150 hover:bg-green-50 ${
                  index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <td className="py-4 px-6 font-bold text-lg text-green-600">{player.rank}</td>
                <td className="py-4 px-6 font-semibold text-gray-900">{player.playerName}</td>
                <td className="py-4 px-6 text-center font-bold text-lg text-gray-900">{player.totalPoints}</td>
                <td className="py-4 px-6 text-center text-gray-700">{player.wins}</td>
                <td className="py-4 px-6 text-center text-gray-700">{player.draws}</td>
                <td className="py-4 px-6 text-center text-gray-700">{player.losses}</td>
                <td className="py-4 px-6 text-center text-gray-700">{player.pointsFor}</td>
                <td className="py-4 px-6 text-center text-gray-700">{player.pointsAgainst}</td>
                <td className={`py-4 px-6 text-center font-bold text-lg ${
                  player.pointsDifference > 0 ? 'text-green-600' : 
                  player.pointsDifference < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {player.pointsDifference > 0 ? '+' : ''}{player.pointsDifference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
