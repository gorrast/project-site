'use client'

import type { Consumer } from './types'
import { CONSUMER_COLORS } from './colors'

const OPTS: { key: string; val: Consumer }[] = [
  { key: 'S', val: 'shared' },
  { key: 'H', val: 'Hugo' },
  { key: 'B', val: 'Benjamin' },
]

interface SHBControlProps {
  activeValue: Consumer | null
  onSelect: (value: Consumer) => void
  /** Only meaningful for a nullable value (the Products tab's default,
   * which can genuinely have "no default"). When provided, clicking the
   * already-active option clears it; when omitted, clicking it is a no-op —
   * a receipt line always has exactly one of the three, with nothing to
   * revert to. */
  onClear?: () => void
  titleFor?: (value: Consumer, isActive: boolean) => string
}

export function SHBControl({ activeValue, onSelect, onClear, titleFor }: SHBControlProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[10px] bg-gray-100 dark:bg-white/10 p-0.5">
      {OPTS.map(({ key, val }) => {
        const isActive = activeValue === val
        return (
          <button
            key={key}
            type="button"
            title={titleFor?.(val, isActive)}
            onClick={() => (isActive ? onClear?.() : onSelect(val))}
            className="w-8 h-6 rounded-md font-mono text-xs font-medium transition-colors"
            style={{
              backgroundColor: isActive ? CONSUMER_COLORS[val] : 'transparent',
              color: isActive ? '#ffffff' : '#6b7280',
            }}
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}
