'use client'

import React, { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { useReducedMotion } from 'motion/react'
import { ChartContainer } from '@/components/ui/chart'
import { FormChip } from './FormChip'
import { TeamGameweekData } from './types'

interface ClusteredColumnChartProps {
  data: TeamGameweekData[]
  teamName: string
}

const Y_AXIS_WIDTH = 36

export default function ClusteredColumnChart({ data, teamName }: ClusteredColumnChartProps) {
  // The readout above the chart follows the hovered gameweek and falls back to the latest one.
  const [hovered, setHovered] = useState<number | null>(null)
  const reduced = useReducedMotion()

  const sorted = [...data].sort((a, b) => a.gameweek - b.gameweek)
  const chartData = sorted.map((d, idx) => {
    const prev = sorted[idx - 1]
    return {
      gameweek: d.gameweek,
      pointsFor: prev ? d.pointsFor - prev.pointsFor : d.pointsFor,
      pointsAgainst: prev ? d.pointsAgainst - prev.pointsAgainst : d.pointsAgainst,
      opponentName: d.opponentName ?? '',
    }
  })

  if (chartData.length === 0) return null

  const shown = chartData[hovered != null && hovered < chartData.length ? hovered : chartData.length - 1]
  const result = shown.pointsFor > shown.pointsAgainst ? 'W' : shown.pointsFor < shown.pointsAgainst ? 'L' : 'D'

  const follow = (state: { isTooltipActive: boolean; activeTooltipIndex?: number | string | null }) =>
    setHovered(state.isTooltipActive && state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : null)

  return (
    <div className="rounded-2xl border border-line bg-surface py-5 pr-4 pl-1 sm:pr-6 sm:pl-3">
      <div
        className="mb-3.5 flex min-h-8 flex-wrap items-center gap-x-3.5 gap-y-2 text-sm"
        style={{ marginLeft: Y_AXIS_WIDTH + 10 }}
        aria-live="polite"
      >
        <span className="font-mono text-xs text-ink-3">GW {shown.gameweek}</span>
        <FormChip result={result} />
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="size-2 rounded-[2px] bg-accent" />
          {teamName} <span className="font-mono font-medium tabular-nums">{shown.pointsFor}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
          <span className="size-2 rounded-[2px] bg-neg" />
          {shown.opponentName || 'Opponent'} <span className="font-mono font-medium text-ink tabular-nums">{shown.pointsAgainst}</span>
        </span>
      </div>
      <ChartContainer config={{}} className="block h-[clamp(240px,32vw,320px)] w-full aspect-auto">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barGap={1}
          onMouseMove={follow}
          onTouchMove={follow}
          onClick={follow}
          onMouseLeave={() => setHovered(null)}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="gameweek" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={Y_AXIS_WIDTH} />
          {/* No floating panel: the tooltip only draws the column highlight. */}
          <Tooltip content={() => null} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar
            dataKey="pointsFor"
            fill="var(--accent)"
            radius={[2, 2, 0, 0]}
            maxBarSize={12}
            isAnimationActive={!reduced}
            animationDuration={600}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="pointsAgainst"
            fill="var(--neg)"
            radius={[2, 2, 0, 0]}
            maxBarSize={12}
            isAnimationActive={!reduced}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </BarChart>
      </ChartContainer>
      <div className="mt-3 flex justify-center gap-[18px] text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-[9px] rounded-[2px] bg-accent" />
          Points for
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-[9px] rounded-[2px] bg-neg" />
          Points against
        </span>
      </div>
    </div>
  )
}
