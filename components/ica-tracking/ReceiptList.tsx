'use client'

import { useEffect, useRef } from 'react'
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
  const selectedRef = useRef<HTMLButtonElement>(null)
  // ← → can move the selection off-screen inside the scrolling pane.
  // Only when it actually moves, so opening the tab doesn't scroll the page.
  const last = useRef(selectedId)
  useEffect(() => {
    if (last.current !== selectedId) selectedRef.current?.scrollIntoView({ block: 'nearest' })
    last.current = selectedId
  }, [selectedId])

  return (
    <div className="flex min-w-0 flex-[1_1_360px] flex-col overflow-hidden rounded-2xl border border-line bg-surface max-lg:max-h-[50dvh] lg:h-full">
      <div className="shrink-0 px-[18px] py-3.5 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
        {receipts.length} receipts · {monthLabel}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {receipts.length === 0 && <p className="border-t border-line px-[18px] py-6 text-sm text-ink-3">No receipts this month.</p>}
        {receipts.map(r => {
          const selected = selectedId === r.id
          return (
            <button
              key={r.id}
              ref={selected ? selectedRef : undefined}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(r.id)}
              className={cn(
                'grid w-full cursor-pointer grid-cols-[3px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-3 pr-[18px] pl-3.5 text-left',
                selected ? 'bg-surface-3' : 'hover:bg-surface-2',
                r.excluded && 'opacity-55'
              )}
            >
              <span className="h-8 w-[3px] rounded-[2px]" style={{ backgroundColor: CONSUMER_COLORS[r.buyer] }} />
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="truncate text-sm font-medium">{r.store ?? 'Unknown store'}</span>
                <span className="truncate font-mono text-[11px] text-ink-3">
                  {fmtDate(r.purchasedAt)} · {r.buyer} paid
                </span>
              </span>
              <span className="flex flex-col items-end gap-[3px]">
                <span className={cn('font-mono text-[13px]', r.excluded && 'line-through')}>{kr(r.total)}</span>
                <span className={cn('font-mono text-[10px] tracking-[0.06em] uppercase', r.excluded ? 'text-warn' : 'text-ink-3')}>
                  {r.excluded ? 'excluded' : `${r.lines.length} lines`}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
