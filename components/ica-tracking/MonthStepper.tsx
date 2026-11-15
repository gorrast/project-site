'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MonthSummary } from './types'

interface MonthStepperProps {
  months: MonthSummary[]
  currentKey: string
  onChange: (key: string) => void
}

export function MonthStepper({ months, currentKey, onChange }: MonthStepperProps) {
  const index = months.findIndex(m => m.key === currentKey)
  const current = months[index]
  const canGoOlder = index > 0
  const canGoNewer = index >= 0 && index < months.length - 1

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        disabled={!canGoOlder}
        onClick={() => canGoOlder && onChange(months[index - 1].key)}
        aria-label="Previous month"
      >
        <ChevronLeft />
      </Button>
      <span aria-live="polite" className="min-w-[140px] text-center font-display text-base font-semibold tracking-[-0.01em]">
        {current?.label ?? '–'}
      </span>
      <Button
        variant="outline"
        size="icon"
        disabled={!canGoNewer}
        onClick={() => canGoNewer && onChange(months[index + 1].key)}
        aria-label="Next month"
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
