import type { Consumer, MonthData, Tally } from './types'

/** Applies a local consumer override to one line (by id) and cascades it to
 * any product-level discount lines folded under it, then recomputes the
 * tally. There's no read-time resolution chain anymore — `consumer` is the
 * literal source of truth for every line, so this is a direct assignment,
 * not a fallback computation. */
export function withLineConsumer(data: MonthData, lineId: number, consumer: Consumer): MonthData {
  const receipts = data.receipts.map(r => {
    if (!r.lines.some(l => l.id === lineId)) return r
    return {
      ...r,
      lines: r.lines.map(l => (l.id === lineId ? { ...l, consumer } : l)),
    }
  })
  return { ...data, receipts, tally: recomputeTally(receipts, data.tally) }
}

export function withReceiptExcluded(data: MonthData, receiptId: string, excluded: boolean): MonthData {
  const receipts = data.receipts.map(r => (r.id === receiptId ? { ...r, excluded } : r))
  return { ...data, receipts, tally: recomputeTally(receipts, data.tally) }
}

function recomputeTally(receipts: MonthData['receipts'], prevTally: Tally): Tally {
  const t: Tally = {
    Hugo: 0, Benjamin: 0, shared: 0, total: 0, discount: 0,
    receiptCount: prevTally.receiptCount, countedReceiptCount: 0,
  }
  for (const r of receipts) {
    if (r.excluded) continue
    t.countedReceiptCount += 1
    for (const line of r.lines) {
      t[line.consumer] += line.grossTotal
      t.total += line.grossTotal
      if (line.appliesToLineId || line.isReceiptDiscount) t.discount += -line.grossTotal
      // Product-level discounts folded under discountLines follow their
      // parent's consumer (the backend keeps their own stored value in sync
      // via a write-time cascade — see api/ica_tracking.py's
      // set_line_consumer), so attribute them to the parent's value here too.
      for (const d of line.discountLines) {
        t[line.consumer] += d.lineTotal
        t.total += d.lineTotal
        t.discount += -d.lineTotal
      }
    }
  }
  return t
}
