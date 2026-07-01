'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { PlayPilotRating } from './types'

interface RatingsHistogramProps {
  ratings: PlayPilotRating[]
  username: string
}

const chartConfig: ChartConfig = {
  count: { label: 'Titles', color: '#3b82f6' },
}

function HistogramTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-bold text-gray-600 dark:text-gray-400 mb-1">Rating {label}</p>
      <p className="text-gray-900 dark:text-gray-100 font-semibold">{payload[0].value} titles</p>
    </div>
  )
}

export default function RatingsHistogram({ ratings, username }: RatingsHistogramProps) {
  const counts = Array.from({ length: 10 }, (_, i) => ({ score: String(i + 1), count: 0 }))
  ratings.forEach(({ score }) => {
    const bucket = counts[Math.round(score) - 1]
    if (bucket) bucket.count += 1
  })

  const total = ratings.length
  const average = total > 0 ? ratings.reduce((sum, r) => sum + r.score, 0) / total : 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 sm:p-6 border border-gray-100 dark:border-gray-700">
      <h3 className="text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">
        {username} — Rating Distribution
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {total} rated titles · average {average.toFixed(2)}
      </p>
      <ChartContainer config={chartConfig} className="block h-[280px] sm:h-[400px] w-full aspect-auto">
        <BarChart data={counts} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis dataKey="score" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
          <Tooltip content={<HistogramTooltip />} cursor={{ fill: 'transparent' }} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
