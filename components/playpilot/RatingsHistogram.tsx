'use client'

import React from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { PlayPilotRating } from './types'

interface RatingsHistogramProps {
  ratings: PlayPilotRating[]
  username: string
  selectedRating: number | null
  onSelectRating: (score: number) => void
}

const chartConfig: ChartConfig = {
  count: { label: 'Titles', color: '#2563eb' },
}

const DEFAULT_FILL = '#2563eb' // blue-600
const SELECTED_FILL = '#9333ea' // purple-600

function HistogramTooltip({ active, payload, label, total }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  total: number
}) {
  if (!active || !payload?.length) return null
  const count = payload[0].value
  const percent = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-bold text-gray-600 dark:text-gray-400 mb-1">Rating {label}</p>
      <p className="text-gray-900 dark:text-gray-100 font-semibold">
        {count} titles <span className="text-gray-500 dark:text-gray-400 font-normal">({percent.toFixed(1)}%)</span>
      </p>
    </div>
  )
}

export default function RatingsHistogram({ ratings, username, selectedRating, onSelectRating }: RatingsHistogramProps) {
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
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {total} rated titles · average {average.toFixed(2)}
        {selectedRating !== null && (
          <>
            {' · '}
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              filtered to rating {selectedRating}
            </span>
          </>
        )}
      </p>
      <ChartContainer config={chartConfig} className="block h-[280px] sm:h-[400px] w-full aspect-auto">
        <BarChart data={counts} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis dataKey="score" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
          <Tooltip content={<HistogramTooltip total={total} />} cursor={{ fill: 'rgba(147, 51, 234, 0.08)' }} />
          <Bar
            dataKey="count"
            radius={[2, 2, 0, 0]}
            cursor="pointer"
            onClick={entry => onSelectRating(Number(entry.payload.score))}
          >
            {counts.map(entry => (
              <Cell
                key={entry.score}
                fill={selectedRating === Number(entry.score) ? SELECTED_FILL : DEFAULT_FILL}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        Click a bar to filter the title list below by that rating.
      </p>
    </div>
  )
}
