'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useReports } from './hooks/useReports'
import { CONSUMER_COLORS, kr, pct } from './colors'
import type { CategoryReport, PersonFilter, Scope } from './types'

interface ReportsSectionProps {
  scope: Scope
  onScopeChange: (scope: Scope) => void
  monthKey: string | null
}

const PERSON_OPTIONS: { id: PersonFilter; label: string; color?: string }[] = [
  { id: 'total', label: 'Total' },
  { id: 'Hugo', label: 'Hugo', color: CONSUMER_COLORS.Hugo },
  { id: 'Benjamin', label: 'Benjamin', color: CONSUMER_COLORS.Benjamin },
  { id: 'shared', label: 'shared', color: CONSUMER_COLORS.shared },
]

function categoryAmount(c: CategoryReport, person: PersonFilter): number {
  return person === 'total' ? c.total : c[person]
}

export function ReportsSection({ scope, onScopeChange, monthKey }: ReportsSectionProps) {
  const [person, setPerson] = useState<PersonFilter>('total')
  const { data, loading } = useReports(scope, monthKey, person)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading text-[19px] font-bold tracking-[-0.01em] text-gray-900 dark:text-gray-100">
          Where the money goes
        </h2>
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 dark:bg-white/10 p-0.5">
          {(['month', 'all'] as Scope[]).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => onScopeChange(id)}
              className={cn(
                'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                scope === id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-[0_1px_2px_rgba(17,24,39,0.10)]'
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {id === 'month' ? 'Active month' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        {data && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {data.label} · {kr(data.total)} · net of discounts, excluded receipts omitted
          </p>
        )}
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 dark:bg-white/10 p-0.5">
          {PERSON_OPTIONS.map(opt => {
            const active = person === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPerson(opt.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  active
                    ? 'bg-white dark:bg-gray-700 shadow-[0_1px_2px_rgba(17,24,39,0.10)]'
                    : 'text-gray-500 dark:text-gray-400'
                )}
                style={active && opt.color ? { color: opt.color } : undefined}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {!loading && data && (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
            <div className="px-4 pt-3 pb-1 font-mono text-[10.5px] uppercase text-gray-500 dark:text-gray-400">
              Top products
            </div>
            {data.topProducts.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-400">No products in this scope.</div>
            )}
            {data.topProducts.map(p => {
              const maxTotal = data.topProducts[0]?.total || 1
              return (
                <div
                  key={p.name}
                  className="grid items-center gap-2 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700"
                  style={{ gridTemplateColumns: '16px minmax(0,1fr) 56px 40px 82px' }}
                >
                  <span className="font-mono text-[10.5px] text-gray-400">{p.rank}</span>
                  <span className="text-[13px] text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                  <span
                    className={cn('h-[5px] rounded-full', person === 'total' && 'bg-gray-600 dark:bg-gray-400')}
                    style={{ width: pct(p.total, maxTotal), backgroundColor: person === 'total' ? undefined : CONSUMER_COLORS[person] }}
                  />
                  <span className="font-mono text-[11px] text-gray-400 text-right">×{p.count}</span>
                  <span className="font-mono text-xs text-gray-900 dark:text-gray-100 text-right">{kr(p.total)}</span>
                </div>
              )
            })}
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
            <div className="px-4 pt-3 pb-1 font-mono text-[10.5px] uppercase text-gray-500 dark:text-gray-400">
              By category
            </div>
            {data.categories.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-400">No categories in this scope.</div>
            )}
            {data.categories.map(c => (
              <div
                key={c.name}
                className="grid items-center gap-2 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700"
                style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr) 82px' }}
              >
                <span className="text-[13px] text-gray-900 dark:text-gray-100 truncate">{c.name}</span>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10">
                  <span
                    style={{
                      width: pct(c.shared, c.total),
                      backgroundColor: CONSUMER_COLORS.shared,
                      opacity: person === 'total' || person === 'shared' ? 1 : 0.35,
                    }}
                  />
                  <span
                    style={{
                      width: pct(c.Hugo, c.total),
                      backgroundColor: CONSUMER_COLORS.Hugo,
                      opacity: person === 'total' || person === 'Hugo' ? 1 : 0.35,
                    }}
                  />
                  <span
                    style={{
                      width: pct(c.Benjamin, c.total),
                      backgroundColor: CONSUMER_COLORS.Benjamin,
                      opacity: person === 'total' || person === 'Benjamin' ? 1 : 0.35,
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-gray-900 dark:text-gray-100 text-right">
                  {kr(categoryAmount(c, person))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
