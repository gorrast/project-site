'use client'

import React from 'react'

type Result = 'W' | 'D' | 'L'

const MARK = 'inline-grid size-5 shrink-0 place-items-center rounded-md font-mono text-[10px] font-semibold'

// Washes mix in srgb: `in oklch` with transparent tints sand pink in Chromium.
const RESULT_CLASS: Record<Result, string> = {
  W: 'bg-[color-mix(in_srgb,var(--pos)_18%,transparent)] text-pos',
  D: 'bg-surface-3 text-ink-3',
  L: 'bg-[color-mix(in_srgb,var(--neg)_18%,transparent)] text-neg',
}

interface FormChipProps {
  result: Result
  title?: string
}

export function FormChip({ result, title }: FormChipProps) {
  return (
    <span title={title} className={`${MARK} ${RESULT_CLASS[result]}`}>
      {result}
    </span>
  )
}

interface FormRowProps {
  entries: { result: Result; title?: string }[]
  slots?: number
}

export function FormRow({ entries, slots = 5 }: FormRowProps) {
  // Always render a fixed number of slots so this row's width never depends
  // on how much history exists — otherwise anything positioned after it
  // (e.g. a win% column) shifts row-to-row. Missing history pads on the
  // left (oldest end) as a muted placeholder, keeping the most recent
  // result anchored to the same rightmost slot on every row.
  const padded = Array.from({ length: slots }, (_, i) => entries[i - (slots - entries.length)] ?? null)

  return (
    <div className="inline-flex items-center gap-1">
      {padded.map((e, i) =>
        e ? (
          <FormChip key={i} result={e.result} title={e.title} />
        ) : (
          <span key={i} title="No match" className={`${MARK} text-line-strong`}>
            –
          </span>
        )
      )}
    </div>
  )
}
