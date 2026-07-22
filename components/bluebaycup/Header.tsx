'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Season } from './types'

export type ViewTab = 'season' | 'alltime'

interface HeaderProps {
  seasons: Season[]
  selectedSeasonId: string
  onSelectSeason: (seasonId: string) => void
  activeTab: ViewTab
  onSelectTab: (tab: ViewTab) => void
}

export default function Header({ seasons, selectedSeasonId, onSelectSeason, activeTab, onSelectTab }: HeaderProps) {
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const selectedSeason = seasons.find(s => s.seasonId === selectedSeasonId)
  const seasonsNewestFirst = [...seasons].sort((a, b) => Number(b.seasonId) - Number(a.seasonId))

  const handleSeasonButtonClick = () => {
    if (activeTab === 'season') {
      setSeasonMenuOpen(prev => !prev)
    } else {
      onSelectTab('season')
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-[68px] flex items-center">
      <div className="max-w-[1080px] w-full mx-auto px-3 bbc:px-5 flex items-center gap-2 bbc:gap-4">
        <Link
          href="/"
          aria-label="Go to homepage"
          className="w-9 h-9 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-base text-gray-700 dark:text-gray-200"
        >
          ⌂
        </Link>
        <span className="hidden bbc:inline text-2xl leading-none">⚽</span>
        <span className="font-heading font-bold text-base bbc:text-xl text-gray-900 dark:text-gray-100 whitespace-nowrap">
          Blue Bay Cup
        </span>

        <div className="ml-auto flex items-center gap-1.5 bbc:gap-2.5">
          <button
            type="button"
            onClick={() => onSelectTab('alltime')}
            className={`px-3 py-2 bbc:px-4 bbc:py-2.5 rounded-lg text-xs bbc:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'alltime'
                ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            All-Time
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={handleSeasonButtonClick}
              className={`px-3 py-2 bbc:px-4 bbc:py-2.5 rounded-lg text-xs bbc:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'season'
                  ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              {selectedSeason?.seasonName ?? 'Season'} <span className="text-xs">▾</span>
            </button>

            {seasonMenuOpen && (
              <div className="absolute top-[calc(100%+6px)] right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px] max-h-[260px] overflow-y-auto z-50">
                {seasonsNewestFirst.map(s => (
                  <button
                    key={s.seasonId}
                    type="button"
                    onClick={() => { onSelectSeason(s.seasonId); onSelectTab('season'); setSeasonMenuOpen(false) }}
                    className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      s.seasonId === selectedSeasonId ? 'font-bold text-blue-600' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {s.seasonName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle dark mode"
              className="relative w-11 h-6 rounded-full bg-gray-200 dark:bg-gray-600 shrink-0 cursor-pointer"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-900 shadow flex items-center justify-center text-xs transition-transform ${
                  resolvedTheme === 'dark' ? 'translate-x-5' : ''
                }`}
              >
                {resolvedTheme === 'dark' ? '☾' : '☀'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
