'use client'

const HINTS: { key: string; label: string }[] = [
  { key: '↑ ↓', label: 'line' },
  { key: '← →', label: 'receipt' },
  { key: 'S', label: 'shared' },
  { key: 'H', label: 'Hugo' },
  { key: 'B', label: 'Benjamin' },
  { key: 'E', label: 'exclude receipt' },
]

export function KeyboardHints() {
  return (
    <div aria-label="Keyboard shortcuts" className="flex flex-wrap gap-x-[18px] gap-y-2 text-xs text-ink-3">
      {HINTS.map(h => (
        <span key={h.key} className="inline-flex items-center gap-1.5">
          <kbd className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink">{h.key}</kbd>
          {h.label}
        </span>
      ))}
    </div>
  )
}
