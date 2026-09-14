'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useProductMonthly, useProductOptions } from './hooks/useProductMonthly'
import { useMonths } from './hooks/useMonths'
import { ProductSelector } from './ProductSelector'
import { BUDGET_COLOR, CONSUMER_COLORS, inkColor, kr, mutedColor } from './colors'
import type { Consumer, ProductMonthlyCell } from './types'

const GRID_LINES = [0, 25, 50, 75]
// Stack order bottom-to-top (matches the handoff's stackKeys) — the first
// entry with a nonzero value gets the rounded top corner.
const STACK_KEYS: Consumer[] = ['Benjamin', 'Hugo', 'shared']

interface Stat {
  label: string
  value: string
  color: string
}

function computeStats(months: ProductMonthlyCell[], ink: string, muted: string): Stat[] {
  const total = months.reduce((a, m) => a + m.total, 0)
  const active = months.filter(m => m.count > 0).length
  const last = months[months.length - 1]
  const prev = months[months.length - 2]
  const delta = last && prev ? last.total - prev.total : 0
  const sums: Record<Consumer, number> = { shared: 0, Hugo: 0, Benjamin: 0 }
  for (const m of months) {
    sums.shared += m.shared
    sums.Hugo += m.Hugo
    sums.Benjamin += m.Benjamin
  }
  const top = (Object.entries(sums) as [Consumer, number][]).sort((a, b) => b[1] - a[1])[0]

  return [
    { label: `All ${months.length} months`, value: kr(total), color: ink },
    { label: 'Average per month', value: kr(months.length ? total / months.length : 0), color: ink },
    { label: 'Months bought in', value: `${active} of ${months.length}`, color: ink },
    {
      label: 'Latest vs previous',
      value: `${delta > 0 ? '+' : ''}${kr(delta)}`,
      color: delta > 0 ? BUDGET_COLOR : '#059669',
    },
    {
      label: 'Mostly',
      value: top && top[1] > 0 ? (top[0] === 'shared' ? 'Shared' : top[0]) : '—',
      color: top && top[1] > 0 ? CONSUMER_COLORS[top[0]] : muted,
    },
  ]
}

export function ProductOverTime() {
  const { data: options } = useProductOptions()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const { resolvedTheme } = useTheme()
  const ink = inkColor(resolvedTheme)
  const muted = mutedColor(resolvedTheme)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Defaults to everything selected — a sensible starting point ("total
  // household spend over time") — the first time options load.
  useEffect(() => {
    function run() {
      if (options && !initialized) {
        setSelected(new Set(options.options.map(o => o.name)))
        setInitialized(true)
      }
    }
    run()
  }, [options, initialized])

  const { data } = useProductMonthly([...selected])
  const { data: monthsList } = useMonths()

  if (!options || options.options.length === 0) return null

  // Keeps the chart/stats shell mounted at a fixed shape even with nothing
  // selected — an all-zero series over the real month range, rather than
  // the section disappearing and reappearing every time the selection is
  // cleared. The canonical month range comes from useMonths() (independent
  // of any product selection), not from the product-monthly response,
  // which is simply absent when there's nothing to fetch for.
  const months =
    data?.months ??
    (monthsList?.months ?? []).map(m => ({
      key: m.key, label: m.label, short: m.short,
      Hugo: 0, Benjamin: 0, shared: 0, total: 0, count: 0,
    }))
  const maxTotal = Math.max(1, ...months.map(m => m.total))
  const scale = Math.max(50, Math.ceil((maxTotal * 1.15) / 50) * 50)
  const yTicks = [scale, scale * 0.75, scale * 0.5, scale * 0.25, 0]
  const hoverMonth = hoverIndex !== null ? months[hoverIndex] : null
  const hoverTop = hoverMonth ? 100 - (hoverMonth.total / scale) * 100 : 0
  const stats = computeStats(months, ink, muted)

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-[18px] pt-5 pb-3.5 shadow-[0_10px_15px_-3px_rgba(17,24,39,0.08),0_4px_6px_-4px_rgba(17,24,39,0.05)] flex flex-col">
      <div className="flex flex-wrap gap-2.5 items-center justify-between mb-4">
        <h3 className="font-heading text-base font-semibold text-gray-900 dark:text-gray-100">Products over time</h3>
        <ProductSelector options={options.options} selected={selected} onChange={setSelected} />
      </div>

      {months.length > 0 && (
        <>
          <div className="grid gap-2.5 mb-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(126px, 1fr))' }}>
            {stats.map(s => (
              <div key={s.label} className="border border-gray-100 dark:border-gray-700 rounded-[10px] px-3 py-2.5 flex flex-col gap-1 min-w-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.label}</div>
                <div className="font-mono text-sm font-medium whitespace-nowrap" style={{ color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2" style={{ height: 210 }}>
            <div className="w-10 flex flex-col justify-between items-end text-[11px] text-gray-500 dark:text-gray-400">
              {yTicks.map((t, i) => (
                <span key={i} className="whitespace-nowrap" style={{ transform: 'translateY(-50%)' }}>
                  {Math.round(t).toLocaleString('sv-SE')}
                </span>
              ))}
            </div>
            <div className="relative flex-1 min-w-0">
              {GRID_LINES.map(pct => (
                <div
                  key={pct}
                  className="absolute left-0 right-0 border-t border-dashed border-[#cccccc]"
                  style={{ top: `${pct}%` }}
                />
              ))}
              <div className="absolute left-0 right-0 bottom-0 border-t border-[#cccccc]" />

              <div className="absolute inset-0 flex items-stretch">
                {months.map((m, i) => {
                  let capped = false
                  return (
                    <div
                      key={m.key}
                      onMouseEnter={() => setHoverIndex(i)}
                      onMouseLeave={() => setHoverIndex(null)}
                      className={cn(
                        'relative flex-1 min-w-0 flex items-end justify-center px-1.5',
                        hoverIndex === i && 'bg-black/[0.03] dark:bg-white/[0.06]'
                      )}
                    >
                      <div className="w-full max-w-[30px] flex flex-col justify-end h-full">
                        {STACK_KEYS.map(key => {
                          const h = (Math.max(0, m[key]) / scale) * 100
                          const isTop = !capped && h > 0
                          if (isTop) capped = true
                          return (
                            <div
                              key={key}
                              style={{
                                height: `${h}%`,
                                backgroundColor: CONSUMER_COLORS[key],
                                borderRadius: isTop ? '2px 2px 0 0' : 0,
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {hoverMonth && (
                <div
                  className="absolute pointer-events-none min-w-[168px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-[7px] shadow-[0_10px_15px_-3px_rgba(17,24,39,0.14)] z-10"
                  style={{
                    left: `${((hoverIndex! + 0.5) / months.length) * 100}%`,
                    top: `${hoverTop}%`,
                    transform: hoverTop < 40 ? 'translate(-50%, 22%)' : 'translate(-50%, -112%)',
                  }}
                >
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5 whitespace-nowrap">{hoverMonth.label}</p>
                  {[
                    { label: 'Total', color: ink, value: kr(hoverMonth.total) },
                    { label: 'Shared', color: CONSUMER_COLORS.shared, value: kr(hoverMonth.shared) },
                    { label: 'Hugo', color: CONSUMER_COLORS.Hugo, value: kr(hoverMonth.Hugo) },
                    { label: 'Benjamin', color: CONSUMER_COLORS.Benjamin, value: kr(hoverMonth.Benjamin) },
                    { label: 'Bought', color: '#e5e7eb', value: `${hoverMonth.count}×` },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-2 py-0.5 text-[11.5px]">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.label}</span>
                      <span className="ml-auto pl-4 font-mono font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1.5">
            <div className="w-10 shrink-0" />
            <div className="flex-1 min-w-0 flex">
              {months.map(m => (
                <div key={m.key} className="flex-1 min-w-0 text-center text-[11px] text-gray-400 truncate">
                  {m.short}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-3.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS.shared }} /> Shared
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS.Hugo }} /> Hugo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-[9px] h-[9px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS.Benjamin }} /> Benjamin
            </span>
          </div>
        </>
      )}
    </div>
  )
}
