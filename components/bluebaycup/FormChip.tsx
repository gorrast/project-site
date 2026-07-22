'use client'

import React from 'react'

type Result = 'W' | 'D' | 'L'

const RESULT_COLORS: Record<Result, string> = {
  W: '#16a34a',
  D: '#9ca3af',
  L: '#ef4444',
}

interface FormChipProps {
  result: Result
  title?: string
}

export function FormChip({ result, title }: FormChipProps) {
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-[9px] font-bold text-white shrink-0"
      style={{ backgroundColor: RESULT_COLORS[result] }}
    >
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
          <span
            key={i}
            className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-[9px] font-bold text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 shrink-0"
          >
            –
          </span>
        )
      )}
    </div>
  )
}
