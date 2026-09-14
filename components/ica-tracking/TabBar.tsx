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
    <div className="flex border-b border-gray-200 dark:border-gray-700">
      {TABS.map(t => {
        const active = t.id === tab
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 font-heading text-sm font-medium -mb-px border-b-2 transition-colors',
              active
                ? 'text-gray-900 dark:text-gray-100 border-gray-900 dark:border-gray-100'
                : 'text-gray-500 dark:text-gray-400 border-transparent'
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
