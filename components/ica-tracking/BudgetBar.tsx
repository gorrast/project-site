'use client'

import { BUDGET_COLOR, kr, MONTHLY_BUDGET_KR } from './colors'

export function BudgetBar({ total }: { total: number }) {
  const over = total > MONTHLY_BUDGET_KR
  const color = over ? BUDGET_COLOR : undefined
  const pct = Math.min(100, (total / MONTHLY_BUDGET_KR) * 100)
  const note = over ? `${kr(total - MONTHLY_BUDGET_KR)} over` : `${kr(MONTHLY_BUDGET_KR - total)} left`

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-[18px] py-4 shadow-[0_1px_3px_rgba(17,24,39,0.06)]">
      <div className="flex items-center justify-between">
        <span className="font-heading text-sm font-medium text-gray-900 dark:text-gray-100">
          Monthly target {kr(MONTHLY_BUDGET_KR)}
        </span>
        <span
          className="font-mono text-[12.5px]"
          style={{ color: color ?? 'inherit' }}
        >
          {note}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color ?? '#111827' }}
        />
      </div>
    </div>
  )
}
