'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { SectionHeading } from '@/components/SectionHeading'
import { Segmented } from '@/components/ui/segmented'
import { MetricGroup, quietItemProps } from '@/components/ui/Motion'
import { useReports } from './hooks/useReports'
import { CONSUMER_COLORS, CONSUMER_LABELS, formatQuantity, kr, pct } from './colors'
import type { CategoryReport, Consumer, PersonFilter, Scope } from './types'

interface ReportsSectionProps {
  scope: Scope
  onScopeChange: (scope: Scope) => void
  monthKey: string | null
}

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]
const PEOPLE: { value: PersonFilter; label: string }[] = [
  { value: 'total', label: 'Everyone' },
  { value: 'shared', label: 'Shared' },
  { value: 'Hugo', label: 'Hugo' },
  { value: 'Benjamin', label: 'Benjamin' },
]
const STACK: Consumer[] = ['shared', 'Hugo', 'Benjamin']

const cardClass = 'min-w-0 overflow-hidden rounded-2xl border border-line bg-surface'
const cardLabel = 'font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase'
const rowClass = 'grid min-h-[42px] items-center border-t border-line px-5 py-2 text-sm whitespace-nowrap'

function categoryAmount(c: CategoryReport, person: PersonFilter): number {
  return person === 'total' ? c.total : c[person]
}

export function ReportsSection({ scope, onScopeChange, monthKey }: ReportsSectionProps) {
  const [person, setPerson] = useState<PersonFilter>('total')
  const { data, error } = useReports(scope, monthKey, person)
  const maxTotal = data?.topProducts[0]?.total || 1

  return (
    <section>
      <SectionHeading
        title="Where the money goes"
        caption={data && `${data.label} · ${kr(data.total)} · net of discounts, excluded receipts left out`}
      >
        <div className="flex flex-wrap gap-2.5">
          <Segmented label="Period" size="sm" options={SCOPES} value={scope} onChange={onScopeChange} />
          <Segmented label="Whose food" size="sm" options={PEOPLE} value={person} onChange={setPerson} />
        </div>
      </SectionHeading>

      {error && <p role="alert" className="mb-4 text-[13px] text-neg">Couldn&apos;t load the report: {error}. Reload the page to try again.</p>}

      {data && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
          <div className={cardClass}>
            <div className={`px-5 pt-4 pb-2.5 ${cardLabel}`}>Top products</div>
            {data.topProducts.length === 0 && <p className="border-t border-line px-5 py-6 text-sm text-ink-3">Nothing bought in this period.</p>}
            <MetricGroup stagger={0.04}>
              {data.topProducts.map(p => (
                <motion.div
                  key={p.name}
                  {...quietItemProps}
                  className={`${rowClass} grid-cols-[18px_minmax(0,1fr)_minmax(0,0.45fr)_34px_auto] gap-2.5`}
                >
                  <span className="font-mono text-[11px] text-ink-3">{p.rank}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    {(p.quantityKg > 0 || p.quantitySt > 0) && (
                      <span className="block font-mono text-[11px] text-ink-3">{formatQuantity(p.quantityKg, p.quantitySt)}</span>
                    )}
                  </span>
                  <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-[3px] bg-surface-3">
                    <span
                      className="block h-full rounded-[3px]"
                      style={{
                        width: pct(p.total, maxTotal),
                        backgroundColor: person === 'total' ? 'var(--series-muted)' : CONSUMER_COLORS[person],
                      }}
                    />
                  </span>
                  <span className="text-right font-mono text-xs text-ink-3">×{p.count}</span>
                  <span className="text-right font-mono text-[13px]">{kr(p.total)}</span>
                </motion.div>
              ))}
            </MetricGroup>
          </div>

          <div className={cardClass}>
            <div className="flex flex-wrap justify-between gap-3 px-5 pt-4 pb-2.5">
              <span className={cardLabel}>By category</span>
              <span className="flex gap-3 text-xs text-ink-3">
                {STACK.map(c => (
                  <span key={c} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS[c] }} />
                    {CONSUMER_LABELS[c]}
                  </span>
                ))}
              </span>
            </div>
            {data.categories.length === 0 && <p className="border-t border-line px-5 py-6 text-sm text-ink-3">Nothing bought in this period.</p>}
            <MetricGroup stagger={0.04}>
              {data.categories.map(c => (
                <motion.div
                  key={c.name}
                  {...quietItemProps}
                  title={`${c.name}: shared ${kr(c.shared)}, Hugo ${kr(c.Hugo)}, Benjamin ${kr(c.Benjamin)}`}
                  className={`${rowClass} grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] gap-3`}
                >
                  <span className="truncate">{c.name}</span>
                  <span aria-hidden="true" className="flex h-2.5 overflow-hidden rounded-[3px] bg-surface-3">
                    {STACK.map(k => (
                      <span
                        key={k}
                        style={{
                          width: pct(c[k], c.total),
                          backgroundColor: CONSUMER_COLORS[k],
                          opacity: person === 'total' || person === k ? 1 : 0.35,
                        }}
                      />
                    ))}
                  </span>
                  <span className="text-right font-mono text-[13px]">{kr(categoryAmount(c, person))}</span>
                </motion.div>
              ))}
            </MetricGroup>
          </div>
        </div>
      )}
    </section>
  )
}
