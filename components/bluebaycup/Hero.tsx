'use client'

import React from 'react'

interface HeroProps {
  seasonCount: number
}

export default function Hero({ seasonCount }: HeroProps) {
  return (
    <div className="text-center mb-9">
      <h1 className="font-heading font-bold text-4xl text-gray-900 dark:text-gray-100">Blue Bay Cup</h1>
      <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">
        Fantasy Draft Premier League — {seasonCount} season{seasonCount === 1 ? '' : 's'} played
      </p>
    </div>
  )
}
