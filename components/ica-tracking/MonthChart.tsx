'use client'

import { useTheme } from 'next-themes'
import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { BUDGET_COLOR, CONSUMER_COLORS, inkColor, kr, MONTHLY_BUDGET_KR } from './colors'
import type { TrendsMonth } from './types'

const Y_AXIS_WIDTH = 40
const X_AXIS_HEIGHT = 20
const PLOT_HEIGHT = 280

const chartConfig: ChartConfig = {
  shared: { label: 'Shared', color: CONSUMER_COLORS.shared },
  Hugo: { label: 'Hugo', color: CONSUMER_COLORS.Hugo },
  Benjamin: { label: 'Benjamin', color: CONSUMER_COLORS.Benjamin },
  total: { label: 'Total', color: '#111827' },
}

interface MonthChartProps {
  months: TrendsMonth[]
  onMonthClick: (key: string) => void
}

export function MonthChart({ months, onMonthClick }: MonthChartProps) {
  const { resolvedTheme } = useTheme()
  const ink = inkColor(resolvedTheme)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const maxTotal = Math.max(0, ...months.map(m => m.total))
  const scale = Math.ceil((Math.max(MONTHLY_BUDGET_KR, maxTotal) * 1.12) / 500) * 500
  const yTicks = [0, scale * 0.25, scale * 0.5, scale * 0.75, scale]
  const y = (v: number) => 100 - (Math.max(0, v) / scale) * 100

  const hoverMonth = hoverIndex !== null ? months[hoverIndex] : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl px-[18px] pt-5 pb-3.5 shadow-[0_10px_15px_-3px_rgba(17,24,39,0.08),0_4px_6px_-4px_rgba(17,24,39,0.05)]">
      <div className="mb-[18px] font-heading text-base font-semibold text-gray-900 dark:text-gray-100">
        Spending by month, against a {kr(MONTHLY_BUDGET_KR)} target
      </div>
      <div className="relative" style={{ height: PLOT_HEIGHT }}>
        <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
          <ComposedChart data={months} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={3} barCategoryGap="20%">
            <CartesianGrid horizontal vertical={false} stroke="#cccccc" strokeDasharray="3 3" />
            <XAxis dataKey="short" height={X_AXIS_HEIGHT} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, scale]}
              ticks={yTicks}
              width={Y_AXIS_WIDTH}
              tickFormatter={v => Math.round(v).toLocaleString('sv-SE')}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={MONTHLY_BUDGET_KR} stroke={BUDGET_COLOR} strokeDasharray="4 4" strokeWidth={2} />
            <Bar dataKey="shared" fill={CONSUMER_COLORS.shared} radius={[2, 2, 0, 0]} maxBarSize={16} />
            <Bar dataKey="Hugo" fill={CONSUMER_COLORS.Hugo} radius={[2, 2, 0, 0]} maxBarSize={16} />
            <Bar dataKey="Benjamin" fill={CONSUMER_COLORS.Benjamin} radius={[2, 2, 0, 0]} maxBarSize={16} />
            <Line dataKey="total" stroke={ink} strokeWidth={2} dot={{ r: 3, fill: ink, strokeWidth: 0 }} activeDot={false} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>

        {/* Hover/click overlay, sized to match the chart's plot area (left:
            YAxis width, bottom: XAxis height) so percentage math lines up
            with the bars/line recharts drew underneath. */}
        <div className="absolute" style={{ left: Y_AXIS_WIDTH, right: 8, top: 4, bottom: X_AXIS_HEIGHT }}>
          <div className="relative h-full flex">
            {months.map((m, i) => (
              <div
                key={m.key}
                className={cn('flex-1 cursor-pointer', hoverIndex === i && 'bg-black/[0.03] dark:bg-white/[0.06]')}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={() => onMonthClick(m.key)}
              />
            ))}
            {hoverMonth && (
              <div
                className="absolute pointer-events-none min-w-[168px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-[7px] shadow-[0_10px_15px_-3px_rgba(17,24,39,0.14)] z-10"
                style={{
                  left: `${((hoverIndex! + 0.5) / months.length) * 100}%`,
                  top: `${y(hoverMonth.total)}%`,
                  transform: y(hoverMonth.total) < 40 ? 'translate(-50%, 22%)' : 'translate(-50%, -118%)',
                }}
              >
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1">{hoverMonth.label}</p>
                {[
                  { label: 'Total', color: ink, value: kr(hoverMonth.total) },
                  { label: 'Shared', color: CONSUMER_COLORS.shared, value: kr(hoverMonth.shared) },
                  { label: 'Hugo', color: CONSUMER_COLORS.Hugo, value: kr(hoverMonth.Hugo) },
                  { label: 'Benjamin', color: CONSUMER_COLORS.Benjamin, value: kr(hoverMonth.Benjamin) },
                  { label: 'vs budget', color: BUDGET_COLOR, value: kr(hoverMonth.total - MONTHLY_BUDGET_KR) },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-1.5 py-0.5 text-xs">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                    <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                    <span className="ml-auto font-mono text-gray-900 dark:text-gray-100">{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS.shared }} /> Shared
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS.Hugo }} /> Hugo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS.Benjamin }} /> Benjamin
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ backgroundColor: ink }} /> Total
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: BUDGET_COLOR }} /> Budget
        </span>
      </div>
    </div>
  )
}
