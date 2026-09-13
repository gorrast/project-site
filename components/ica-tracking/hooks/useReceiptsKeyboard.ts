import { useEffect } from 'react'
import type { Consumer, Receipt } from '../types'

const KEY_TO_CONSUMER: Record<string, Consumer> = { s: 'shared', h: 'Hugo', b: 'Benjamin' }

interface Params {
  active: boolean
  receipts: Receipt[]
  selectedReceiptId: string | null
  cursor: number
  setCursor: (updater: (c: number) => number) => void
  selectReceipt: (id: string) => void
  setLineConsumer: (lineId: number, consumer: Consumer) => void
  setReceiptExcluded: (receiptId: string, excluded: boolean) => void
}

/** Ports the prototype's componentDidMount keydown handler (Food
 * Expenses.dc.html). Cursor order is receipt.lines as returned by the API —
 * article lines first, then receipt-level discount lines, matching the
 * prototype's editable.concat(receiptDiscounts). */
export function useReceiptsKeyboard({
  active, receipts, selectedReceiptId, cursor, setCursor, selectReceipt, setLineConsumer, setReceiptExcluded,
}: Params) {
  useEffect(() => {
    if (!active) return

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = (target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      const receiptIndex = receipts.findIndex(r => r.id === selectedReceiptId)
      const receipt = receiptIndex >= 0 ? receipts[receiptIndex] : receipts[0]
      if (!receipt) return
      const editable = receipt.lines

      const k = e.key.toLowerCase()

      const move = (d: number) => {
        e.preventDefault()
        setCursor(c => Math.max(0, Math.min(editable.length - 1, c + d)))
      }
      if (k === 'arrowdown' || k === 'j') return move(1)
      if (k === 'arrowup' || k === 'k') return move(-1)

      if (k === 'arrowright' || k === 'arrowleft' || k === '[' || k === ']') {
        e.preventDefault()
        const d = k === 'arrowright' || k === ']' ? 1 : -1
        const nextIndex = Math.max(0, Math.min(receipts.length - 1, receiptIndex + d))
        const next = receipts[nextIndex]
        if (next) {
          selectReceipt(next.id)
          setCursor(() => 0)
        }
        return
      }

      if (k === 'e') {
        e.preventDefault()
        setReceiptExcluded(receipt.id, !receipt.excluded)
        return
      }

      const val = KEY_TO_CONSUMER[k]
      if (val) {
        e.preventDefault()
        const line = editable[Math.min(cursor, editable.length - 1)]
        if (!line) return
        setLineConsumer(line.id, val)
        setCursor(c => Math.min(editable.length - 1, c + 1))
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, receipts, selectedReceiptId, cursor, setCursor, selectReceipt, setLineConsumer, setReceiptExcluded])
}
