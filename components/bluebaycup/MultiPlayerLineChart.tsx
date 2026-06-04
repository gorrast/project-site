'use client'

import React, { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { PlayerProgressData } from './types'

interface MultiPlayerLineChartProps {
  playersData: PlayerProgressData[]
  title: string
  dataKey: 'rank' | 'totalPoints' | 'pointsFor' | 'pointsAgainst'
  invertYAxis?: boolean
}

const COLORS = [
  '#3b82f6', 
  '#ef4444', 
  '#10b981', 
  '#f59e0b', 
  '#8b5cf6', 
  '#ec4899'
]

export default function MultiPlayerLineChart({
  playersData,
  title,
  dataKey,
  invertYAxis = false,
}: MultiPlayerLineChartProps) {
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null)

  if (playersData.length === 0) return null

  const isAverageMetric = dataKey === 'pointsFor' || dataKey === 'pointsAgainst'

  const gwStart = isAverageMetric ? 1 : 0
  const chartData = Array.from({ length: 39 - gwStart }, (_, idx) => {
    const i = idx + gwStart
    const row: Record<string, number | null | string> = { gameweek: `GW${i}` }
    playersData.forEach(player => {
      const gw = player.gameweeks.find(g => g.gameweek === i)
      if (!gw || gw[dataKey] == null) {
        row[player.playerName] = null
      } else if (isAverageMetric) {
        row[player.playerName] = parseFloat(((gw[dataKey] as number) / i).toFixed(1))
      } else {
        row[player.playerName] = gw[dataKey]
      }
    })
    return row
  })

  const chartConfig: ChartConfig = Object.fromEntries(
    playersData.map((player, i) => [
      player.playerName,
      { label: player.playerName, color: COLORS[i % COLORS.length] },
    ])
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 sm:p-6 border border-gray-100 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300">
      <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-gray-100">{title}</h3>
      <ChartContainer config={chartConfig} className="block h-[320px] sm:h-[400px] w-full aspect-auto">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis dataKey="gameweek" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis
            reversed={invertYAxis}
            domain={isAverageMetric ? ['auto', 'auto'] : undefined}
            tick={{ fontSize: 11 }}
            width={40}
          />
          <ChartTooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null

              let items = payload.filter(p => p.value != null)

              if (hoveredPlayer) {
                items = items.filter(p => p.dataKey === hoveredPlayer)
              } else {
                items = [...items].sort((a, b) =>
                  invertYAxis
                    ? (a.value as number) - (b.value as number)
                    : (b.value as number) - (a.value as number)
                )
              }

              return (
                <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <p className="font-medium mb-1.5">{label}</p>
                  {items.map(entry => (
                    <div key={entry.dataKey as string} className="flex items-center gap-2 py-0.5">
                      <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-mono font-medium tabular-nums ml-auto pl-4">
                        {isAverageMetric && typeof entry.value === 'number'
                          ? entry.value.toFixed(1)
                          : entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          {playersData.map((player, i) => (
            <Line
              key={player.playerName}
              type="monotone"
              dataKey={player.playerName}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={(dotProps) => {
                const { cx, cy, fill } = dotProps as { cx?: number; cy?: number; fill?: string }
                return (
                  <circle
                    key={player.playerName}
                    cx={cx ?? 0}
                    cy={cy ?? 0}
                    r={5}
                    fill={fill ?? COLORS[i % COLORS.length]}
                    stroke="white"
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPlayer(player.playerName)}
                    onMouseLeave={() => setHoveredPlayer(null)}
                  />
                )
              }}
              connectNulls
            />
          ))}
        </LineChart>
      </ChartContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-3 text-xs">
        {playersData.map((player, i) => (
          <span key={player.playerName} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-muted-foreground">{player.playerName}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
