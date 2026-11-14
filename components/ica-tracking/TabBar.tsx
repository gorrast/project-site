'use client'

import { cn } from '@/lib/utils'
import type { Tab } from './types'

const TABS: { id: Tab; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'trends', label: 'Trends' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'products', label: 'Products' },
]

interface TabBarProps {
  tab: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ tab, onChange }: TabBarProps) {
  return (
    <div role="tablist" aria-label="Views" className="mb-10 flex overflow-x-auto border-b border-line">
      {TABS.map(t => {
        const active = t.id === tab
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px flex-none cursor-pointer border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap',
              active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
