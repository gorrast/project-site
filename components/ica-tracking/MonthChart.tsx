'use client'

import { useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { SectionHeading } from '@/components/SectionHeading'
import { cn } from '@/lib/utils'
import { CONSUMER_COLORS, CONSUMER_LABELS, kr, MONTHLY_BUDGET_KR } from './colors'
import type { Consumer, TrendsMonth } from './types'

const Y_AXIS_WIDTH = 48
const X_AXIS_HEIGHT = 24
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 }
const PLOT_HEIGHT = 300
const STACK: Consumer[] = ['shared', 'Hugo', 'Benjamin']

interface MonthChartProps {
  months: TrendsMonth[]
  /** The month open in the hero; the readout shows it when nothing is hovered. */
  activeKey: string | null
  onMonthClick: (key: string) => void
}

export function MonthChart({ months, activeKey, onMonthClick }: MonthChartProps) {
  const reduced = useReducedMotion()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const maxTotal = Math.max(0, ...months.map(m => m.total))
  const scale = Math.ceil((Math.max(MONTHLY_BUDGET_KR, maxTotal) * 1.12) / 500) * 500
  const yTicks = [0, scale * 0.25, scale * 0.5, scale * 0.75, scale]

  const activeIndex = months.findIndex(m => m.key === activeKey)
  const shown = hoverIndex ?? (activeIndex >= 0 ? activeIndex : months.length - 1)
  const m = months[shown]
  const vs = m ? m.total - MONTHLY_BUDGET_KR : 0

  return (
    <section>
      <SectionHeading
        title="Spending by month"
        caption={`Shared, Hugo and Benjamin each month, with the month total and the ${MONTHLY_BUDGET_KR.toLocaleString('sv-SE')} kr target. Select a month to open it.`}
      />
      <div className="rounded-2xl border border-line bg-surface pt-5 pr-6 pb-4 pl-4">
        {m && (
          <div aria-live="polite" className="mb-3.5 ml-14 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            <span className="font-display text-[15px] font-semibold">{m.label}</span>
            <span className="font-mono">{kr(m.total)}</span>
            {STACK.map(c => (
              <span key={c} className="inline-flex items-center gap-1.5 text-ink-2">
                <span className="size-2 rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS[c] }} />
                {CONSUMER_LABELS[c]} <span className="font-mono">{kr(m[c], false)}</span>
              </span>
            ))}
            <span className={cn('font-mono', vs > 0 ? 'text-neg' : 'text-ink-3')}>
              {vs > 0 ? `${kr(vs)} over target` : `${kr(-vs)} under target`}
            </span>
          </div>
        )}

        <div className="relative" style={{ height: PLOT_HEIGHT }}>
          <ChartContainer config={{}} className="aspect-auto h-full w-full">
            <ComposedChart data={months} margin={MARGIN} barGap={3} barCategoryGap="20%">
              <XAxis dataKey="short" height={X_AXIS_HEIGHT} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis
                domain={[0, scale]}
                ticks={yTicks}
                width={Y_AXIS_WIDTH}
                tickFormatter={v => Math.round(v).toLocaleString('sv-SE')}
                axisLine={false}
                tickLine={false}
              />
              <CartesianGrid vertical={false} />
              {STACK.map(c => (
                <Bar
                  key={c}
                  dataKey={c}
                  fill={CONSUMER_COLORS[c]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={14}
                  isAnimationActive={!reduced}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              ))}
              <ReferenceLine
                y={MONTHLY_BUDGET_KR}
                stroke="var(--neg)"
                strokeDasharray="5 4"
                strokeWidth={2}
                label={{ value: 'target', position: 'insideTopRight', fill: 'var(--neg)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
              <Line
                dataKey="total"
                stroke="var(--ink)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--ink)', stroke: 'var(--surface)', strokeWidth: 2 }}
                activeDot={false}
                isAnimationActive={!reduced}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ChartContainer>

          {/* One button per month over the plot area (left: Y axis, bottom: X
              axis), so hover, focus and click line up with Recharts' bands. */}
          <div
            className="absolute flex"
            style={{ left: Y_AXIS_WIDTH, right: MARGIN.right, top: MARGIN.top, bottom: X_AXIS_HEIGHT }}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {months.map((mo, i) => (
              <button
                key={mo.key}
                type="button"
                aria-label={`${mo.label}: ${kr(mo.total)}. Open this month`}
                onMouseEnter={() => setHoverIndex(i)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
                onClick={() => onMonthClick(mo.key)}
                className={cn(
                  'flex-1 cursor-pointer rounded-md',
                  i === shown ? 'bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]' : 'bg-transparent'
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-[18px] gap-y-1.5 text-xs text-ink-3">
          {STACK.map(c => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className="size-[9px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS[c] }} />
              {CONSUMER_LABELS[c]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 bg-ink" /> Total
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-neg" /> Target
          </span>
        </div>
      </div>
    </section>
  )
}
