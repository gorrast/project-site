'use client'

import React, { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SectionHeading } from '@/components/SectionHeading'
import { cn } from '@/lib/utils'
import { FormRow } from './FormChip'
import SectionSkeleton from './SectionSkeleton'
import { HeadToHeadData } from './types'

interface HeadToHeadProps {
  headToHead: HeadToHeadData
  players: { playerId: string; playerName: string }[]
  seasonCount: number
  isLoading: boolean
}

export default function HeadToHead({ headToHead, players, seasonCount, isLoading }: HeadToHeadProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(players[0]?.playerId ?? '')

  if (players.length === 0) return null

  const active = players.find(p => p.playerId === selectedPlayerId) ?? players[0]
  const opponents = [...(headToHead[active.playerId] ?? [])].sort((a, b) => b.winPct - a.winPct)

  return (
    <>
      <SectionHeading
        title="Head-to-head"
        caption={`Every match across ${seasonCount} seasons, from ${active.playerName}'s side. Sorted by win rate.`}
      />
      {/* Two panes, list first; under 680px the list wraps into a row above the table. */}
      <div className="grid items-start gap-x-6 gap-y-4 bbc:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="flex flex-wrap gap-0.5 bbc:flex-col bbc:flex-nowrap">
          {players.map(p => {
            const selected = p.playerId === active.playerId
            return (
              <button
                key={p.playerId}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedPlayerId(p.playerId)}
                className={cn(
                  'flex h-[38px] cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-sm whitespace-nowrap hover:bg-surface-2',
                  selected ? 'bg-accent-soft text-ink hover:bg-accent-soft' : 'text-ink-2'
                )}
              >
                <span className={cn('size-1.5 shrink-0 rounded-full', selected && 'bg-accent')} />
                {p.playerName}
              </button>
            )
          })}
        </div>

        {isLoading ? (
          <SectionSkeleton />
        ) : opponents.length === 0 ? (
          <p className="text-sm text-ink-3">No recorded matches yet.</p>
        ) : (
          <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Opponent</TableHead>
                  <TableHead className="text-right">W–D–L</TableHead>
                  <TableHead>Win rate</TableHead>
                  <TableHead className="pr-5">Last 5</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opponents.map(o => (
                  <TableRow key={o.opponentPlayerId}>
                    <TableCell className="pl-5 font-medium">{o.opponentPlayerName}</TableCell>
                    <TableCell className="text-right font-mono text-[13px] text-ink-2 tabular-nums">
                      {o.wins}–{o.draws}–{o.losses}
                    </TableCell>
                    <TableCell className="w-[174px]">
                      <span className="flex items-center gap-2.5">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <span
                            className={cn('block h-full rounded-full', o.winPct >= 50 ? 'bg-pos' : 'bg-neg')}
                            style={{ width: `${o.winPct}%` }}
                          />
                        </span>
                        <span className={cn('w-[38px] text-right font-mono text-[13px] tabular-nums', o.winPct >= 50 ? 'text-ink' : 'text-ink-2')}>
                          {o.winPct.toFixed(0)}%
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="pr-5">
                      <FormRow
                        entries={o.form.map(f => ({
                          result: f.result,
                          title: `GW ${f.gameweek} · ${f.myScore}–${f.oppScore}`,
                        }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  )
}
