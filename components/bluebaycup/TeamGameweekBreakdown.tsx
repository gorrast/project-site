'use client'

import React from 'react'
import { SectionHeading } from '@/components/SectionHeading'
import { cn } from '@/lib/utils'
import ClusteredColumnChart from './ClusteredColumnChart'
import { PlayerProgressData, PlayerSeasonStats } from './types'

interface TeamGameweekBreakdownProps {
  playersData: PlayerProgressData[]
  standings: PlayerSeasonStats[]
  /** Shared with the standings table: one selected manager for the whole view. */
  focusId: string
  onFocus: (playerId: string) => void
}

/** Match by match: points for and against per gameweek for one manager. */
export default function TeamGameweekBreakdown({ playersData, standings, focusId, onFocus }: TeamGameweekBreakdownProps) {
  const selected = playersData.find(p => p.playerId === focusId) ?? playersData[0]
  if (!selected) return null
  const row = standings.find(p => p.playerId === selected.playerId)

  return (
    <>
      <SectionHeading
        title={`${selected.playerName}, match by match`}
        caption={
          (row ? `${row.wins}W ${row.draws}D ${row.losses}L · ${row.pointsFor} points for, ${row.pointsAgainst} against. ` : '') +
          'Pick a manager, then hover a gameweek for the score.'
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {/* Chips follow the standings order so they line up with the table above. */}
        {(standings.length ? standings : playersData).map(p => {
          const pressed = p.playerId === selected.playerId
          return (
            <button
              key={p.playerId}
              type="button"
              aria-pressed={pressed}
              onClick={() => onFocus(p.playerId)}
              className={cn(
                'h-8 cursor-pointer rounded-full border px-3.5 text-[13px] whitespace-nowrap',
                pressed ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong text-ink-2'
              )}
            >
              {p.playerName}
            </button>
          )
        })}
      </div>
      <ClusteredColumnChart
        data={selected.gameweeks.filter(g => g.gameweek > 0).map(g => ({
          gameweek: g.gameweek,
          pointsFor: g.pointsFor,
          pointsAgainst: g.pointsAgainst,
          opponentName: g.opponentName,
        }))}
        teamName={selected.playerName}
      />
    </>
  )
}
