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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-gray-500 dark:text-gray-400">
      {HINTS.map(h => (
        <span key={h.key} className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center min-w-[22px] px-1 py-0.5 rounded-[5px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
            {h.key}
          </span>
          {h.label}
        </span>
      ))}
    </div>
  )
}
