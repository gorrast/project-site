'use client'

import React, { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { useReducedMotion } from 'motion/react'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { PlayerProgressData, TOTAL_GAMEWEEKS } from './types'

interface MultiPlayerLineChartProps {
  playersData: PlayerProgressData[]
  dataKey: 'rank' | 'totalPoints' | 'pointsFor' | 'pointsAgainst'
  invertYAxis?: boolean
}

// The manager palette (--p1…--p12 in globals.css): one fixed colour per
// manager, assigned by player_id, never by array position, so a manager has
// the same colour in every chart and season. This is the one chart that draws
// every manager at once (DESIGN.md › Principles 4).
const PALETTE_SIZE = 12

function colorForPlayerId(playerId: string): string {
  const id = parseInt(playerId, 10)
  const idx = Number.isFinite(id) ? (((id - 1) % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE : 0
  return `var(--p${idx + 1})`
}

const ordinal = (k: number) => k + (k % 100 >= 11 && k % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][k % 10] ?? 'th'))

export default function MultiPlayerLineChart({
  playersData,
  dataKey,
  invertYAxis = false,
}: MultiPlayerLineChartProps) {
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null)
  // Legend pick: one manager forward, the rest faded.
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const reduced = useReducedMotion()

  if (playersData.length === 0) return null

  const isAverageMetric = dataKey === 'pointsFor' || dataKey === 'pointsAgainst'
  const highlighted = playersData.some(p => p.playerId === highlightedId) ? highlightedId : null
  const isLit = (playerId: string) => highlighted == null || highlighted === playerId
  const idByName = new Map(playersData.map(p => [p.playerName, p.playerId]))

  const gwStart = isAverageMetric ? 1 : 0
  // The axis ends at the last gameweek played, so a live season fills the chart.
  const lastGw = Math.min(TOTAL_GAMEWEEKS, Math.max(...playersData.flatMap(p => p.gameweeks.map(g => g.gameweek))))
  const chartData = Array.from({ length: lastGw + 1 - gwStart }, (_, idx) => {
    const i = idx + gwStart
    const row: Record<string, number | null | string> = { gameweek: `GW${i}` }
    playersData.forEach(player => {
      const gw = player.gameweeks.find(g => g.gameweek === i)
      if (!gw || gw[dataKey] == null) {
        row[player.playerName] = null
      } else if (isAverageMetric) {
        row[player.playerName] = parseFloat(((gw[dataKey] as number) / i).toFixed(1))
      } else {
        row[player.playerName] = gw[dataKey]
      }
    })
    return row
  })

  const formatValue = (value: unknown) =>
    typeof value !== 'number' ? String(value) : dataKey === 'rank' ? ordinal(value) : isAverageMetric ? value.toFixed(1) : value

  // Draw the highlighted manager last so the line sits on top.
  const drawOrder = [...playersData].sort((a, b) => Number(a.playerId === highlighted) - Number(b.playerId === highlighted))

  return (
    <div className="rounded-2xl border border-line bg-surface py-5 pr-4 pl-1 sm:pt-6 sm:pr-6 sm:pl-3">
      <ChartContainer config={{}} className="block h-[clamp(300px,42vw,400px)] w-full aspect-auto">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="gameweek" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
          <YAxis
            reversed={invertYAxis}
            domain={dataKey === 'rank' ? [1, playersData.length] : isAverageMetric ? ['auto', 'auto'] : undefined}
            ticks={dataKey === 'rank' ? playersData.map((_, i) => i + 1) : undefined}
            interval={0}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <ChartTooltip
            cursor={{ stroke: 'var(--line-strong)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null

              let items = payload.filter(p => p.value != null)

              if (hoveredPlayer) {
                items = items.filter(p => p.dataKey === hoveredPlayer)
              } else {
                items = [...items].sort((a, b) =>
                  invertYAxis
                    ? (a.value as number) - (b.value as number)
                    : (b.value as number) - (a.value as number)
                )
              }

              return (
                <div className="flex min-w-[190px] flex-col gap-1 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-xs shadow-(--shadow-pop)">
                  <p className="mb-0.5 text-[13px] font-medium">{String(label).replace('GW', 'GW ')}</p>
                  {items.map(entry => (
                    <div
                      key={entry.dataKey as string}
                      className={cn('flex items-center gap-2', !isLit(idByName.get(entry.dataKey as string) ?? '') && 'opacity-40')}
                    >
                      <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: entry.color }} />
                      <span className="flex-1 whitespace-nowrap text-ink-2">{entry.name}</span>
                      <span className="pl-3 font-mono tabular-nums">{formatValue(entry.value)}</span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          {drawOrder.map(player => {
            const color = colorForPlayerId(player.playerId)
            const lit = isLit(player.playerId)
            return (
              <Line
                key={player.playerId}
                type="monotone"
                dataKey={player.playerName}
                stroke={color}
                strokeWidth={highlighted === player.playerId ? 3 : 2}
                strokeOpacity={lit ? 1 : 0.15}
                dot={{ r: 3, fill: color, fillOpacity: lit ? 1 : 0.15, stroke: 'var(--surface)', strokeWidth: 1, strokeOpacity: lit ? 1 : 0 }}
                activeDot={
                  lit &&
                  (dotProps => {
                    const { cx, cy } = dotProps as { cx?: number; cy?: number }
                    return (
                      <circle
                        key={player.playerId}
                        cx={cx ?? 0}
                        cy={cy ?? 0}
                        r={5}
                        fill={color}
                        stroke="var(--surface)"
                        strokeWidth={2}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredPlayer(player.playerName)}
                        onMouseLeave={() => setHoveredPlayer(null)}
                      />
                    )
                  })
                }
                connectNulls
                isAnimationActive={!reduced}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            )
          })}
        </LineChart>
      </ChartContainer>
      <div className="mt-3.5 flex flex-wrap justify-center gap-x-1.5 gap-y-1 pl-3 sm:pl-0">
        {playersData.map(player => {
          const pressed = highlighted === player.playerId
          return (
            <button
              key={player.playerId}
              type="button"
              aria-pressed={pressed}
              onClick={() => setHighlightedId(pressed ? null : player.playerId)}
              className={cn(
                'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs',
                pressed ? 'border-line-strong' : 'border-transparent',
                isLit(player.playerId) ? 'text-ink' : 'text-ink-3'
              )}
            >
              <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: colorForPlayerId(player.playerId) }} />
              {player.playerName}
            </button>
          )
        })}
      </div>
    </div>
  )
}
