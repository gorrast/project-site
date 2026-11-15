'use client'

import type { Consumer } from './types'
import { CONSUMER_COLORS, CONSUMER_LABELS } from './colors'

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
  /** Accessible name for the group, e.g. "Who is Bananas for". */
  label: string
}

/** DESIGN.md › Assign control (S/H/B). */
export function SHBControl({ activeValue, onSelect, onClear, titleFor, label }: SHBControlProps) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg border border-line bg-control-track p-0.5">
      {OPTS.map(({ key, val }) => {
        const isActive = activeValue === val
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            title={titleFor?.(val, isActive) ?? CONSUMER_LABELS[val]}
            onClick={() => (isActive ? onClear?.() : onSelect(val))}
            className="h-6 w-[30px] cursor-pointer rounded-md font-mono text-xs font-semibold"
            style={isActive ? { backgroundColor: CONSUMER_COLORS[val], color: 'var(--c-on)' } : { color: 'var(--ink-3)' }}
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}
