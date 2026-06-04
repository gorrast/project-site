'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart'
import { TeamGameweekData } from './types'

interface ClusteredColumnChartProps {
  data: TeamGameweekData[]
  teamName: string
}

const chartConfig: ChartConfig = {
  pointsFor: { label: 'Points For', color: '#3b82f6' },
  pointsAgainst: { label: 'Points Against', color: '#ef4444' },
}

function GwTooltip({ active, payload, label, teamName }: {
  active?: boolean
  payload?: { dataKey: string; value: number; fill: string; payload: { opponentName: string } }[]
  label?: string
  teamName: string
}) {
  if (!active || !payload?.length) return null
  const opponentName = payload[0]?.payload?.opponentName
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-bold text-gray-600 dark:text-gray-400 mb-1.5">{label}</p>
      {payload.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.fill }} />
          <span className="text-gray-500 dark:text-gray-400">
            {entry.dataKey === 'pointsFor' ? teamName : (opponentName || 'Opponent')}
          </span>
          <span className="ml-auto pl-4 font-semibold text-gray-900 dark:text-gray-100">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ClusteredColumnChart({ data, teamName }: ClusteredColumnChartProps) {
  const sorted = [...data].sort((a, b) => a.gameweek - b.gameweek)
  const chartData = sorted.map((d, idx) => {
    const prev = sorted[idx - 1]
    return {
      gameweek: `GW${d.gameweek}`,
      pointsFor: prev ? d.pointsFor - prev.pointsFor : d.pointsFor,
      pointsAgainst: prev ? d.pointsAgainst - prev.pointsAgainst : d.pointsAgainst,
      opponentName: d.opponentName ?? '',
    }
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 sm:p-6 border border-gray-100 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300">
      <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-gray-100">
        {teamName} — Points For vs Against by Gameweek
      </h3>
      <ChartContainer config={chartConfig} className="block h-[280px] sm:h-[400px] w-full aspect-auto">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis dataKey="gameweek" tick={{ fontSize: 10 }} interval={1} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip content={<GwTooltip teamName={teamName} />} cursor={{ fill: 'transparent' }} />
          <Bar dataKey="pointsFor" fill="var(--color-pointsFor)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="pointsAgainst" fill="var(--color-pointsAgainst)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <div className="flex justify-center gap-6 pt-3 text-xs">
        {Object.entries(chartConfig).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: cfg.color }} />
            <span className="text-muted-foreground">{String(cfg.label)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
