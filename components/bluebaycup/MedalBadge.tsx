'use client'

import React from 'react'

type MedalType = 'gold' | 'silver' | 'bronze'

const MEDAL_COLORS: Record<MedalType, string> = {
  gold: '#eab308',
  silver: '#9ca3af',
  bronze: '#b45309',
}

interface MedalBadgeProps {
  type: MedalType
  count: number
}

export default function MedalBadge({ type, count }: MedalBadgeProps) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-[11px] font-bold">
        –
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full text-white text-[11px] font-bold"
      style={{ backgroundColor: MEDAL_COLORS[type] }}
    >
      {count}
    </span>
  )
}
