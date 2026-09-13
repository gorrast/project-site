import type { Consumer } from './types'

// Fixed in code, not themeable — the legend must mean the same thing in
// every view, so these never change between light and dark.
export const CONSUMER_COLORS: Record<Consumer, string> = {
  Hugo: '#2563eb',
  Benjamin: '#16a34a',
  shared: '#9333ea',
}

export const BUDGET_COLOR = '#dc2626'
export const DISCOUNT_TEXT_COLOR = '#047857'
export const DISCOUNT_DOT_COLOR = '#059669'

export const MONTHLY_BUDGET_KR = 5000

export function kr(n: number): string {
  const s = Math.abs(n).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < -0.004 ? '−' : '') + s + ' kr'
}

export function pct(v: number, total: number): string {
  return total > 0 ? (Math.max(0, v) / total * 100).toFixed(2) + '%' : '0%'
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('sv-SE') + ' ' + d.toTimeString().slice(0, 5)
}

export function inkColor(resolvedTheme: string | undefined): string {
  return resolvedTheme === 'dark' ? '#f3f4f6' : '#111827'
}
