'use client'

import React, { useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import { SectionHeading } from '@/components/SectionHeading'
import MultiPlayerLineChart from './MultiPlayerLineChart'
import { PlayerProgressData } from './types'

type Metric = 'rank' | 'totalPoints' | 'pointsFor' | 'pointsAgainst'

const METRICS: { value: Metric; label: string; title: string; invertYAxis?: boolean }[] = [
  { value: 'rank', label: 'Rank', title: 'Rank by gameweek', invertYAxis: true },
  { value: 'totalPoints', label: 'Total points', title: 'League points by gameweek' },
  { value: 'pointsFor', label: 'Avg points for', title: 'Average points for' },
  { value: 'pointsAgainst', label: 'Avg points against', title: 'Average points against' },
]

interface PerformanceChartProps {
  playersData: PlayerProgressData[]
  /** Says what the chart covers, e.g. "2026/2027, all 10 managers after GW 10." */
  scope: string
}

/** Season development: every manager, one metric at a time. */
export default function PerformanceChart({ playersData, scope }: PerformanceChartProps) {
  const [metric, setMetric] = useState<Metric>('rank')
  const active = METRICS.find(m => m.value === metric) ?? METRICS[0]

  if (playersData.length === 0) return null

  return (
    <>
      <SectionHeading
        title={active.title}
        caption={`${scope} Pick a name under the chart to bring one line forward; hover a gameweek for the full table.`}
      >
        <Segmented label="Metric" size="sm" options={METRICS} value={metric} onChange={setMetric} />
      </SectionHeading>
      <MultiPlayerLineChart playersData={playersData} dataKey={active.value} invertYAxis={active.invertYAxis} />
    </>
  )
}
