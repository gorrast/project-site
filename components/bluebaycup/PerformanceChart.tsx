'use client'

import React, { useState } from 'react'
import MultiPlayerLineChart from './MultiPlayerLineChart'
import { PlayerProgressData } from './types'

type Metric = 'rank' | 'totalPoints' | 'pointsFor' | 'pointsAgainst'

const METRICS: { value: Metric; label: string; title: string; invertYAxis?: boolean }[] = [
  { value: 'rank', label: 'Rank', title: 'Rank Development', invertYAxis: true },
  { value: 'totalPoints', label: 'Total Points', title: 'Points Development' },
  { value: 'pointsFor', label: 'Points For', title: 'Avg. Points For Development' },
  { value: 'pointsAgainst', label: 'Points Against', title: 'Avg. Points Against Development' },
]

interface PerformanceChartProps {
  playersData: PlayerProgressData[]
  seasonName: string
}

export default function PerformanceChart({ playersData, seasonName }: PerformanceChartProps) {
  const [metric, setMetric] = useState<Metric>('rank')
  const active = METRICS.find(m => m.value === metric) ?? METRICS[0]

  if (playersData.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {METRICS.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMetric(m.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              metric === m.value
                ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <MultiPlayerLineChart
        playersData={playersData}
        title={`${seasonName} - ${active.title}`}
        dataKey={active.value}
        invertYAxis={active.invertYAxis}
      />
    </div>
  )
}
