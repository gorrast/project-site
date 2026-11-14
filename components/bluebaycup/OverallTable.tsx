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
import { PlayerOverallStats } from './types'
import MedalBadge from './MedalBadge'

interface OverallTableProps {
  data: PlayerOverallStats[]
}

const NUM = 'text-right font-mono text-[13px] text-ink-2 tabular-nums'
// A missing value shows as –, never 0.
const kr = (v: number) => (v ? `${v.toLocaleString('sv-SE')} kr` : '–')

const MotionRow = motion.create(TableRow)

const columns: ColumnDef<PlayerOverallStats>[] = [
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
    cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
  },
  { accessorKey: 'appearances', header: 'Apps', meta: { className: `min-w-[60px] ${NUM}` } },
  {
    id: 'medals',
    header: 'Medals',
    cell: ({ row }) => (
      <div className="flex gap-3.5">
        <MedalBadge type="gold" count={row.original.goldMedals} />
        <MedalBadge type="silver" count={row.original.silverMedals} />
        <MedalBadge type="bronze" count={row.original.bronzeMedals} />
      </div>
    ),
  },
  {
    accessorKey: 'avgPointsTotal',
    header: 'Avg pts',
    meta: { className: 'min-w-[84px] text-right' },
    cell: ({ getValue }) => <span className="font-mono font-medium tabular-nums">{getValue<number>().toFixed(1)}</span>,
  },
  {
    accessorKey: 'avgPointsFor',
    header: 'Avg PF',
    meta: { className: `min-w-[92px] ${NUM}` },
    cell: ({ getValue }) => getValue<number>().toFixed(1),
  },
  {
    accessorKey: 'avgPointsAgainst',
    header: 'Avg PA',
    meta: { className: `min-w-[92px] ${NUM}` },
    cell: ({ getValue }) => getValue<number>().toFixed(1),
  },
  {
    accessorKey: 'totPrizeMoney',
    header: 'Prize',
    meta: { className: 'min-w-[128px] text-right' },
    cell: ({ getValue }) => (
      <span className={cn('font-mono text-[13px] tabular-nums', getValue<number>() ? 'text-ink' : 'text-ink-3')}>
        {kr(getValue<number>())}
      </span>
    ),
  },
]

export default function OverallTable({ data }: OverallTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="w-full">
      {/* Desktop: full table, >=680px */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface bbc:block">
        <Table className="min-w-[760px]">
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
              <MotionRow key={row.id} {...quietItemProps}>
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
        {data.map(p => (
          <div key={p.playerId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <span className={cn('w-6 shrink-0 text-center font-mono text-[13px]', p.rank <= 3 ? 'text-ink' : 'text-ink-3')}>
              {p.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">{p.playerName}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-3">
                <span>{p.appearances} apps</span>
                <MedalBadge type="gold" count={p.goldMedals} />
                <MedalBadge type="silver" count={p.silverMedals} />
                <MedalBadge type="bronze" count={p.bronzeMedals} />
              </div>
              <div className="mt-1 font-mono text-xs text-ink-3">
                PF {p.avgPointsFor.toFixed(1)} · PA {p.avgPointsAgainst.toFixed(1)}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-lg font-medium tabular-nums">{p.avgPointsTotal.toFixed(1)}</div>
              <div className={cn('font-mono text-xs', p.totPrizeMoney ? 'text-ink-2' : 'text-ink-3')}>{kr(p.totPrizeMoney)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
