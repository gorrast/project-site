'use client'

import { cn } from '@/lib/utils'
import { CONSUMER_COLORS, fmtDate, kr } from './colors'
import type { Receipt } from './types'

interface ReceiptListProps {
  receipts: Receipt[]
  selectedId: string | null
  onSelect: (id: string) => void
  monthLabel: string
}

export function ReceiptList({ receipts, selectedId, onSelect, monthLabel }: ReceiptListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
      <div className="px-4 pt-3 pb-2 font-mono text-[10.5px] uppercase text-gray-500 dark:text-gray-400">
        {receipts.length} receipts · {monthLabel}
      </div>
      {receipts.map(r => (
        <button
          key={r.id}
          type="button"
          onClick={() => onSelect(r.id)}
          className={cn(
            'w-full grid items-center gap-[11px] px-4 py-[11px] pl-[13px] text-left border-t border-gray-100 dark:border-gray-700 transition-colors',
            selectedId === r.id ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'
          )}
          style={{ gridTemplateColumns: '3px minmax(0,1fr) minmax(86px,auto)', opacity: r.excluded ? 0.45 : 1 }}
        >
          <span className="w-[3px] h-[30px] rounded-full" style={{ backgroundColor: CONSUMER_COLORS[r.buyer] }} />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium truncate text-gray-900 dark:text-gray-100">
              {r.store ?? 'Unknown store'}
            </span>
            <span className="block font-mono text-[10.5px] text-gray-500 dark:text-gray-400">
              {fmtDate(r.purchasedAt)} · {r.buyer} paid
            </span>
          </span>
          <span className="text-right">
            <span
              className="block font-mono text-[12.5px] text-gray-900 dark:text-gray-100"
              style={{ textDecoration: r.excluded ? 'line-through' : 'none' }}
            >
              {kr(r.total)}
            </span>
            {r.excluded && (
              <span className="block font-mono text-[9.5px] uppercase text-orange-700">excluded</span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
