'use client'

import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { motion } from 'motion/react'
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricGroup, quietItemProps } from '@/components/ui/Motion'
import { cn } from '@/lib/utils'
import { PlayerSeasonStats } from './types'
import { FormRow } from './FormChip'

interface SeasonTableProps {
  data: PlayerSeasonStats[]
  /** The manager the charts below follow; picking a row changes it. */
  focusId: string
  onFocus: (playerId: string) => void
}

const NUM = 'text-right font-mono text-[13px] text-ink-2 tabular-nums'

function luckClass(val: number) {
  return val > 1 ? 'text-pos' : val < 1 ? 'text-neg' : 'text-ink-2'
}

const formEntries = (form: PlayerSeasonStats['form']) =>
  form.map(f => ({
    result: f.result,
    title: `GW ${f.gameweek} · ${f.myScore}–${f.oppScore} vs ${f.opponentPlayerName}`,
  }))

const MotionRow = motion.create(TableRow)

const columns: ColumnDef<PlayerSeasonStats>[] = [
  {
    accessorKey: 'rank',
    header: 'Rank',
    meta: { className: 'w-10' },
    cell: ({ getValue }) => (
      <span className={cn('font-mono text-[13px]', getValue<number>() <= 3 ? 'text-ink' : 'text-ink-3')}>
        {getValue<number>()}
      </span>
    ),
  },
  {
    accessorKey: 'playerName',
    header: 'Manager',
    meta: { className: 'w-full' },
    cell: ({ row, table }) => {
      const selected = table.options.meta?.focusId === row.original.playerId
      return (
        // The click bubbles to the row's handler; the button makes the row reachable by keyboard.
        <button type="button" aria-pressed={selected} className="flex cursor-pointer items-center gap-2 font-medium">
          {row.original.playerName}
          <span className={cn('size-1.5 shrink-0 rounded-full', selected && 'bg-accent')} />
        </button>
      )
    },
  },
  {
    accessorKey: 'totalPoints',
    header: 'Pts',
    meta: { className: 'min-w-[60px] text-right' },
    cell: ({ getValue }) => <span className="font-mono font-medium tabular-nums">{getValue<number>()}</span>,
  },
  { accessorKey: 'wins', header: 'W', meta: { className: `min-w-11 ${NUM}` } },
  { accessorKey: 'draws', header: 'D', meta: { className: `min-w-11 ${NUM}` } },
  { accessorKey: 'losses', header: 'L', meta: { className: `min-w-11 ${NUM}` } },
  { accessorKey: 'pointsFor', header: 'PF', meta: { className: `min-w-[68px] ${NUM}` } },
  { accessorKey: 'pointsAgainst', header: 'PA', meta: { className: `min-w-[68px] ${NUM}` } },
  {
    accessorKey: 'form',
    header: 'Form',
    cell: ({ getValue }) => <FormRow entries={formEntries(getValue<PlayerSeasonStats['form']>())} />,
  },
  {
    accessorKey: 'luckFactor',
    header: 'Luck',
    meta: { className: 'min-w-[84px] text-right' },
    cell: ({ getValue }) => {
      const val = getValue<number>()
      return <span className={cn('font-mono text-[13px] tabular-nums', luckClass(val))}>{val.toFixed(2)}</span>
    },
  },
]

export default function SeasonTable({ data, focusId, onFocus }: SeasonTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: { focusId },
  })

  return (
    <div className="w-full">
      {/* Desktop: full table, >=680px */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface bbc:block">
        <Table className="min-w-[780px]">
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className={cn('px-1.5 first:pl-5 last:pr-5', header.column.columnDef.meta?.className, 'text-[11px] text-ink-3')}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <MetricGroup as="tbody" stagger={0.04}>
            {table.getRowModel().rows.map(row => (
              <MotionRow
                key={row.id}
                {...quietItemProps}
                data-state={row.original.playerId === focusId ? 'selected' : undefined}
                onClick={() => onFocus(row.original.playerId)}
                className="cursor-pointer"
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className={cn('h-[52px] px-1.5 first:pl-5 last:pr-5', cell.column.columnDef.meta?.className)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </MotionRow>
            ))}
          </MetricGroup>
        </Table>
      </div>

      {/* Mobile: stacked cards, <680px */}
      <div className="flex flex-col gap-2.5 bbc:hidden">
        {data.map(p => {
          const selected = p.playerId === focusId
          return (
            <button
              key={p.playerId}
              type="button"
              aria-pressed={selected}
              onClick={() => onFocus(p.playerId)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left',
                selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
              )}
            >
              <span className={cn('w-6 shrink-0 text-center font-mono text-[13px]', p.rank <= 3 ? 'text-ink' : 'text-ink-3')}>
                {p.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{p.playerName}</span>
                <span className="mt-1 block font-mono text-xs text-ink-3">
                  {p.wins}W {p.draws}D {p.losses}L · PF {p.pointsFor} · PA {p.pointsAgainst}
                </span>
                <span className="mt-1.5 block">
                  <FormRow entries={formEntries(p.form)} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-lg font-medium tabular-nums">{p.totalPoints}</span>
                <span className={cn('block font-mono text-xs', luckClass(p.luckFactor))}>luck {p.luckFactor.toFixed(2)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
