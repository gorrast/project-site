'use client'

import { motion } from 'motion/react'
import { MetricGroup, quietItemProps } from '@/components/ui/Motion'
import { CONSUMER_COLORS, kr } from './colors'
import type { Tally } from './types'

function shareOf(v: number, total: number): string {
  return total > 0 ? Math.round((v / total) * 100) + '% of month' : '–'
}

export function BucketCards({ tally }: { tally: Tally }) {
  const cards = [
    {
      label: 'Month total',
      dot: 'var(--ink)',
      amount: tally.total,
      sub: `${tally.countedReceiptCount} of ${tally.receiptCount} receipts counted`,
    },
    { label: 'Shared', dot: CONSUMER_COLORS.shared, amount: tally.shared, sub: shareOf(tally.shared, tally.total) },
    { label: 'Hugo', dot: CONSUMER_COLORS.Hugo, amount: tally.Hugo, sub: shareOf(tally.Hugo, tally.total) },
    { label: 'Benjamin', dot: CONSUMER_COLORS.Benjamin, amount: tally.Benjamin, sub: shareOf(tally.Benjamin, tally.total) },
    { label: 'Discounts', dot: 'var(--pos)', amount: tally.discount, sub: 'saved this month' },
  ]

  return (
    <MetricGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3">
      {cards.map(c => (
        <motion.div
          key={c.label}
          {...quietItemProps}
          className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface px-5 pt-5 pb-[18px]"
        >
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
            <span className="size-2 flex-none rounded-full" style={{ backgroundColor: c.dot }} />
            {c.label}
          </span>
          <span className="font-mono text-2xl font-medium tracking-[-0.02em] whitespace-nowrap">
            {kr(c.amount, false)}
            <span className="ml-1 text-[13px] text-ink-3">kr</span>
          </span>
          <span className="text-xs text-ink-3">{c.sub}</span>
        </motion.div>
      ))}
    </MetricGroup>
  )
}
