'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { SectionHeading } from '@/components/SectionHeading'
import { useProductMonthly, useProductOptions } from './hooks/useProductMonthly'
import { useMonths } from './hooks/useMonths'
import { ProductSelector } from './ProductSelector'
import { CONSUMER_COLORS, CONSUMER_LABELS, kr } from './colors'
import type { Consumer, ProductMonthlyCell } from './types'

const TICKS = [1, 0.5, 0]
// Stack order bottom-to-top; the first nonzero segment gets the rounded top.
const STACK_KEYS: Consumer[] = ['Benjamin', 'Hugo', 'shared']
const LEGEND: Consumer[] = ['shared', 'Hugo', 'Benjamin']

interface Stat {
  label: string
  value: string
  className?: string
  color?: string
}

function computeStats(months: ProductMonthlyCell[]): Stat[] {
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
    { label: `All ${months.length} months`, value: kr(total) },
    { label: 'Average per month', value: kr(months.length ? total / months.length : 0) },
    { label: 'Months bought in', value: `${active} of ${months.length}` },
    {
      label: 'Latest vs previous',
      value: `${delta > 0 ? '+' : ''}${kr(delta)}`,
      className: delta > 0 ? 'text-neg' : delta < 0 ? 'text-pos' : undefined,
    },
    top && top[1] > 0
      ? { label: 'Mostly', value: CONSUMER_LABELS[top[0]], color: CONSUMER_COLORS[top[0]] }
      : { label: 'Mostly', value: '–', className: 'text-ink-3' },
  ]
}

export function ProductOverTime() {
  const { data: options } = useProductOptions()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
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
  // Defaults to the latest month with a purchase; the current month is often still empty.
  const latestBought = months.findLastIndex(m => m.count > 0)
  const shown = months[hoverIndex ?? (latestBought >= 0 ? latestBought : months.length - 1)]
  const stats = computeStats(months)

  return (
    <section>
      <SectionHeading title="Products over time" caption="Monthly spend on the selected products, split by who it was for.">
        <ProductSelector options={options.options} selected={selected} onChange={setSelected} />
      </SectionHeading>

      {months.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface pt-5 pr-6 pb-4 pl-4">
          <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-4 sm:ml-14">
            {stats.map(s => (
              <div key={s.label} className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-xs text-ink-3">{s.label}</span>
                <span className={cn('font-mono text-xl font-medium tracking-[-0.02em] whitespace-nowrap', s.className)} style={{ color: s.color }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {shown && (
            <div aria-live="polite" className="mb-3 ml-14 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <span className="font-display font-semibold">{shown.label}</span>
              <span className="font-mono">{kr(shown.total)}</span>
              {LEGEND.map(c => (
                <span key={c} className="inline-flex items-center gap-1.5 text-ink-2">
                  <span className="size-2 rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS[c] }} />
                  {CONSUMER_LABELS[c]} <span className="font-mono">{kr(shown[c], false)}</span>
                </span>
              ))}
              <span className="font-mono text-ink-3">{shown.count}× bought</span>
            </div>
          )}

          <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-2">
            <div className="relative h-[180px]">
              {TICKS.map(f => (
                <span
                  key={f}
                  className="absolute right-0 -translate-y-1/2 font-mono text-[10px] text-ink-3"
                  style={{ top: `${(1 - f) * 100}%` }}
                >
                  {Math.round(scale * f).toLocaleString('sv-SE')}
                </span>
              ))}
            </div>
            <div className="relative h-[180px]" onMouseLeave={() => setHoverIndex(null)}>
              {TICKS.map(f => (
                <span key={f} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - f) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex">
                {months.map((m, i) => {
                  let capped = false
                  return (
                    <div
                      key={m.key}
                      title={`${m.label}: ${kr(m.total)} (${m.count}×)`}
                      onMouseEnter={() => setHoverIndex(i)}
                      className={cn(
                        'flex min-w-0 flex-1 items-end justify-center rounded-md px-px sm:px-1.5',
                        hoverIndex === i && 'bg-surface-2'
                      )}
                    >
                      <div className="flex h-full w-full max-w-7 flex-col justify-end">
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
                                borderRadius: isTop ? '3px 3px 0 0' : 0,
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div />
            <div className="mt-2.5 flex">
              {months.map((m, i) => (
                <span
                  key={m.key}
                  // Every third label (sixth on phones) so full "Sep 2025" labels fit.
                  className={cn(
                    'flex min-w-0 flex-1 justify-center font-mono text-[10px] whitespace-nowrap',
                    i === hoverIndex ? 'text-ink' : 'text-ink-3',
                    i % 3 !== 0 && 'invisible',
                    i % 6 !== 0 && 'max-sm:invisible'
                  )}
                >
                  {m.short}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-x-[18px] gap-y-1.5 text-xs text-ink-3">
            {LEGEND.map(c => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span className="size-[9px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS[c] }} />
                {CONSUMER_LABELS[c]}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
