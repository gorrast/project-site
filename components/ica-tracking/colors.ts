import type { Consumer } from './types'

// Person colours are data identities: the --c-* tokens switch with the theme
// but always mean the same person (DESIGN.md › Food Expenses consumers).
export const CONSUMER_COLORS: Record<Consumer, string> = {
  Hugo: 'var(--c-hugo)',
  Benjamin: 'var(--c-benjamin)',
  shared: 'var(--c-shared)',
}

export const CONSUMER_LABELS: Record<Consumer, string> = { shared: 'Shared', Hugo: 'Hugo', Benjamin: 'Benjamin' }

export const MONTHLY_BUDGET_KR = 5000

export function kr(n: number, unit = true): string {
  const s = Math.abs(n).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < -0.004 ? '−' : '') + s + (unit ? ' kr' : '')
}

export function pct(v: number, total: number): string {
  return total > 0 ? (Math.max(0, v) / total * 100).toFixed(2) + '%' : '0%'
}

/** Formats a quantity total kept as separate kg/st sums (see
 * api/ica_tracking.py's add_quantity) — the schema has no unit column, so a
 * single blended number would be meaningless whenever a product (or a
 * group of raw_names sharing a display_name) mixes weight-based and
 * packaged units. Shows whichever side(s) are nonzero; '—' if neither. */
export function formatQuantity(kg: number, st: number): string {
  const parts: string[] = []
  if (Math.abs(kg) > 0.0005) parts.push(`${kg.toLocaleString('sv-SE', { maximumFractionDigits: 3 })} kg`)
  if (Math.abs(st) > 0.0005) parts.push(`${st.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} st`)
  return parts.length ? parts.join(' + ') : '–'
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('sv-SE') + ' ' + d.toTimeString().slice(0, 5)
}
