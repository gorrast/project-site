'use client'

import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SHBControl } from './SHBControl'
import { CONSUMER_COLORS, fmtDate, inkColor, kr } from './colors'
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
  return Number.isInteger(quantity) ? `${quantity} st` : `${quantity.toFixed(3)} kg`
}

function discountTitle(line: ReceiptLine): string {
  const n = line.discountLines.length
  const off = kr(-line.discountTotal)
  const of = kr(line.grossTotal)
  return n > 1 ? `${n} discount lines, ${off} off ${of}` : `Discount line, ${off} off ${of}`
}

export function ReceiptDetail({ receipt, cursor, onCursorChange, onSetLineConsumer, onToggleExcluded }: ReceiptDetailProps) {
  const { resolvedTheme } = useTheme()
  const ink = inkColor(resolvedTheme)
  const cursorId = receipt.lines.length ? receipt.lines[Math.min(cursor, receipt.lines.length - 1)].id : null

  const st = { Hugo: 0, Benjamin: 0, shared: 0 }
  for (const l of receipt.lines) {
    st[l.consumer] += l.netTotal
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <div className="font-heading text-[15px] font-bold text-gray-900 dark:text-gray-100">
            {receipt.store ?? 'Unknown store'}
          </div>
          <div className="font-mono text-[10.5px] text-gray-500 dark:text-gray-400">
            {fmtDate(receipt.purchasedAt)} · {receipt.buyer} paid · {receipt.kivraId}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={onToggleExcluded}
          className={receipt.excluded ? '!bg-orange-50 !border-orange-200 !text-orange-800 dark:!bg-orange-900/30 dark:!border-orange-800 dark:!text-orange-300' : ''}
        >
          {receipt.excluded ? 'Excluded — include again' : 'Exclude receipt'}
        </Button>
      </div>

      {receipt.excluded && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 text-xs">
          Excluded from all totals and reports — paid privately, not from the shared account.
        </div>
      )}

      <div className="flex-1">
        {receipt.lines.map(line => {
          const isCursor = line.id === cursorId
          return (
            <div
              key={line.id}
              className={cn(
                'grid items-center gap-2 px-4 py-[9px] border-t border-gray-100 dark:border-gray-700',
                !isCursor && line.isReceiptDiscount && 'bg-gray-50/60 dark:bg-white/[0.03]'
              )}
              style={{
                gridTemplateColumns: 'minmax(0,1fr) auto',
                // Only the left border marks the keyboard cursor — a full
                // background wash was nearly unreadable in dark mode (light
                // text on what became a near-white fill).
                boxShadow: isCursor ? `inset 3px 0 0 ${ink}` : 'none',
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {line.isReceiptDiscount && (
                    <span className="font-mono text-[9.5px] uppercase rounded-[5px] px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300">
                      receipt
                    </span>
                  )}
                  <span className="text-[13px] text-gray-900 dark:text-gray-100 truncate">{line.displayName}</span>
                  {line.discountLines.length > 0 && (
                    <span
                      title={discountTitle(line)}
                      className="font-mono text-[9.5px] rounded-[5px] px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300"
                    >
                      {kr(line.discountTotal)}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-gray-400 mt-0.5">
                  {line.isReceiptDiscount ? 'applies to whole receipt' : qtyLabel(line.quantity)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <SHBControl
                  activeValue={line.consumer}
                  onSelect={val => {
                    onSetLineConsumer(line.id, val)
                    onCursorChange(receipt.lines.findIndex(x => x.id === line.id))
                  }}
                />
                <div className="min-w-[68px] text-right">
                  <div
                    className="font-mono text-[12.5px]"
                    style={{ color: line.isReceiptDiscount ? '#047857' : undefined }}
                  >
                    {kr(line.isReceiptDiscount ? line.grossTotal : line.netTotal)}
                  </div>
                  {line.discountLines.length > 0 && (
                    <div className="font-mono text-[10px] text-gray-400">was {kr(line.grossTotal)}</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-2 px-4 py-3.5 bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}>
        {[
          { label: 'hugo', color: CONSUMER_COLORS.Hugo, amount: kr(st.Hugo) },
          { label: 'benjamin', color: CONSUMER_COLORS.Benjamin, amount: kr(st.Benjamin) },
          { label: 'shared', color: CONSUMER_COLORS.shared, amount: kr(st.shared) },
          { label: 'receipt total', color: '#4b5563', amount: kr(receipt.total) },
        ].map(s => (
          <div key={s.label}>
            <div className="font-mono text-[9.5px] uppercase" style={{ color: s.color }}>{s.label}</div>
            <div className="font-mono text-[13.5px] text-gray-900 dark:text-gray-100">{s.amount}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
