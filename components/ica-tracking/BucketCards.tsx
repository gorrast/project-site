'use client'

import { CONSUMER_COLORS, DISCOUNT_DOT_COLOR, kr } from './colors'
import type { Tally } from './types'

interface Card {
  label: string
  color: string
  amount: string
  sub: string
}

function shareOf(v: number, total: number): string {
  return total > 0 ? Math.round((v / total) * 100) + '% of month' : '—'
}

export function BucketCards({ tally }: { tally: Tally }) {
  const cards: Card[] = [
    {
      label: 'month total',
      color: '#111827',
      amount: kr(tally.total),
      sub: `${tally.countedReceiptCount} of ${tally.receiptCount} receipts counted`,
    },
    { label: 'hugo', color: CONSUMER_COLORS.Hugo, amount: kr(tally.Hugo), sub: shareOf(tally.Hugo, tally.total) },
    {
      label: 'benjamin',
      color: CONSUMER_COLORS.Benjamin,
      amount: kr(tally.Benjamin),
      sub: shareOf(tally.Benjamin, tally.total),
    },
    { label: 'shared', color: CONSUMER_COLORS.shared, amount: kr(tally.shared), sub: shareOf(tally.shared, tally.total) },
    { label: 'discounts', color: DISCOUNT_DOT_COLOR, amount: kr(tally.discount), sub: 'saved this month' },
  ]

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(172px, 1fr))' }}>
      {cards.map(c => (
        <div
          key={c.label}
          className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-[18px] py-4 shadow-[0_1px_3px_rgba(17,24,39,0.06)]"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              {c.label}
            </span>
          </div>
          <div className="font-heading text-[26px] font-bold tracking-[-0.02em] text-gray-900 dark:text-gray-100">
            {c.amount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
