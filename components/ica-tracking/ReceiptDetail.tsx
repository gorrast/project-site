'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SHBControl } from './SHBControl'
import { CONSUMER_COLORS, fmtDate, kr } from './colors'
import type { Consumer, Receipt, ReceiptLine } from './types'

interface ReceiptDetailProps {
  receipt: Receipt
  cursor: number
  onCursorChange: (index: number) => void
  onSetLineConsumer: (lineId: number, consumer: Consumer) => void
  onToggleExcluded: () => void
}

function qtyLabel(quantity: number | null): string {
  if (quantity === null) return ''
  return Number.isInteger(quantity) ? `${quantity} st` : `${quantity.toLocaleString('sv-SE', { maximumFractionDigits: 3 })} kg`
}

function discountTitle(line: ReceiptLine): string {
  const n = line.discountLines.length
  const off = kr(-line.discountTotal)
  const of = kr(line.grossTotal)
  return n > 1 ? `${n} discount lines, ${off} off ${of}` : `Discount line, ${off} off ${of}`
}

const washPos = 'rounded-md bg-[color-mix(in_srgb,var(--pos)_18%,transparent)] px-1.5 py-px font-mono text-pos'

export function ReceiptDetail({ receipt, cursor, onCursorChange, onSetLineConsumer, onToggleExcluded }: ReceiptDetailProps) {
  const cursorId = receipt.lines.length ? receipt.lines[Math.min(cursor, receipt.lines.length - 1)].id : null
  const cursorRef = useRef<HTMLDivElement>(null)
  // ↑ ↓ can move the cursor off-screen inside the scrolling pane.
  // Only when it actually moves, so opening the tab doesn't scroll the page.
  const last = useRef(cursorId)
  useEffect(() => {
    if (last.current !== cursorId) cursorRef.current?.scrollIntoView({ block: 'nearest' })
    last.current = cursorId
  }, [cursorId])

  const st = { Hugo: 0, Benjamin: 0, shared: 0 }
  for (const l of receipt.lines) {
    st[l.consumer] += l.netTotal
  }

  return (
    <div className="flex min-w-0 flex-[999_1_460px] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:h-full">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-[18px] py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-lg font-semibold tracking-[-0.01em]">{receipt.store ?? 'Unknown store'}</span>
          <span className="font-mono text-[11px] text-ink-3">
            {fmtDate(receipt.purchasedAt)} · {receipt.buyer} paid · {receipt.kivraId}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={receipt.excluded}
          onClick={onToggleExcluded}
          className={receipt.excluded ? 'border-warn bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-ink' : undefined}
        >
          {receipt.excluded ? 'Excluded · include again' : 'Exclude receipt'}
        </Button>
      </div>

      {receipt.excluded && (
        <div className="mx-[18px] mb-3 shrink-0 rounded-[10px] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-3 py-2.5 text-[13px]">
          Excluded from every total and report. Paid privately, not from the shared account.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {receipt.lines.map(line => {
          const isCursor = line.id === cursorId
          const amount = line.isReceiptDiscount ? line.grossTotal : line.netTotal
          return (
            <div
              key={line.id}
              ref={isCursor ? cursorRef : undefined}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-line px-[18px] py-2.5',
                // The cursor is a wash plus an accent edge: a full wash alone was unreadable in dark mode.
                isCursor && 'bg-surface-2 shadow-[inset_3px_0_0_var(--accent)]'
              )}
            >
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="flex min-w-0 items-center gap-2">
                  {line.isReceiptDiscount && <span className={`${washPos} text-[10px] tracking-[0.06em] uppercase`}>receipt</span>}
                  {/* Wraps rather than truncates: the name is what's being assigned. */}
                  <span className="text-sm leading-[1.3]">{line.displayName}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-3">
                  {line.isReceiptDiscount ? 'applies to the whole receipt' : [qtyLabel(line.quantity), line.category].filter(Boolean).join(' · ')}
                  {line.discountLines.length > 0 && (
                    <span title={discountTitle(line)} className={washPos}>
                      {kr(line.discountTotal)}
                    </span>
                  )}
                </span>
              </span>
              <SHBControl
                label={`Who is ${line.displayName} for`}
                activeValue={line.consumer}
                onSelect={val => {
                  onSetLineConsumer(line.id, val)
                  onCursorChange(receipt.lines.findIndex(x => x.id === line.id))
                }}
              />
              <span className="flex min-w-[84px] flex-col items-end">
                <span className={cn('font-mono text-[13px]', amount < 0 && 'text-pos')}>{kr(amount)}</span>
                {line.discountLines.length > 0 && <span className="font-mono text-[10px] text-ink-3">was {kr(line.grossTotal)}</span>}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-3 border-t border-line bg-surface-2 px-[18px] py-3.5">
        {[
          { label: 'Hugo', color: CONSUMER_COLORS.Hugo, amount: st.Hugo },
          { label: 'Benjamin', color: CONSUMER_COLORS.Benjamin, amount: st.Benjamin },
          { label: 'Shared', color: CONSUMER_COLORS.shared, amount: st.shared },
          { label: 'Receipt', color: 'var(--ink)', amount: receipt.total },
        ].map(s => (
          <div key={s.label} className="flex flex-col gap-[3px]">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] text-ink-3 uppercase">
              <span className="size-[7px] rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-mono text-sm">{kr(s.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
