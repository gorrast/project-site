'use client'

import React from 'react'

type MedalType = 'gold' | 'silver' | 'bronze'

const MEDAL_DOT: Record<MedalType, string> = {
  gold: 'bg-gold',
  silver: 'bg-silver',
  bronze: 'bg-bronze',
}

interface MedalBadgeProps {
  type: MedalType
  count: number
}

export default function MedalBadge({ type, count }: MedalBadgeProps) {
  return (
    <span
      title={`${count} ${type}`}
      className={`inline-flex min-w-7 items-center gap-1.5 font-mono text-[13px] ${count ? 'text-ink' : 'text-ink-3'}`}
    >
      <span className={`size-2 rounded-full ${count ? MEDAL_DOT[type] : 'bg-surface-3'}`} />
      {count || '–'}
    </span>
  )
}
