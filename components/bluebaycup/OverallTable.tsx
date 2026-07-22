'use client'

import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { PlayerOverallStats } from './types'
import MedalBadge from './MedalBadge'

interface OverallTableProps {
  data: PlayerOverallStats[]
}

const columns: ColumnDef<PlayerOverallStats>[] = [
  {
    accessorKey: 'rank',
    header: 'Rank',
    cell: ({ getValue }) => (
      <span className="font-heading font-bold text-xl text-blue-600">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: 'playerName',
    header: 'Player',
    cell: ({ getValue }) => (
      <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'appearances',
    header: 'App\'s',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => (
      <span className="font-semibold text-gray-700 dark:text-gray-300">{getValue<number>()}</span>
    ),
  },
  {
    id: 'medals',
    header: 'Medals',
    meta: { className: 'text-center' },
    cell: ({ row }) => (
      <div className="flex items-center justify-center gap-1.5">
        <MedalBadge type="gold" count={row.original.goldMedals} />
        <MedalBadge type="silver" count={row.original.silverMedals} />
        <MedalBadge type="bronze" count={row.original.bronzeMedals} />
      </div>
    ),
  },
  {
    accessorKey: 'avgPointsTotal',
    header: 'Avg. Pts',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => (
      <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{getValue<number>().toFixed(1)}</span>
    ),
  },
  {
    accessorKey: 'avgPointsFor',
    header: 'Avg. PF',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => (
      <span className="text-gray-700 dark:text-gray-300">{getValue<number>().toFixed(1)}</span>
    ),
  },
  {
    accessorKey: 'avgPointsAgainst',
    header: 'Avg. PA',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => (
      <span className="text-gray-700 dark:text-gray-300">{getValue<number>().toFixed(1)}</span>
    ),
  },
  {
    accessorKey: 'totPrizeMoney',
    header: 'Prize',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => (
      <span className="font-bold text-green-600">{getValue<number>().toLocaleString()} kr</span>
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
      <div className="hidden bbc:block rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-linear-to-r from-blue-600 to-purple-600">
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="border-0 hover:bg-transparent has-aria-expanded:bg-transparent">
                {hg.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'py-4 px-6 text-white font-bold text-sm uppercase tracking-wider whitespace-nowrap',
                      header.column.columnDef.meta?.className
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row, index) => (
              <TableRow
                key={row.id}
                className={cn(
                  'transition-all duration-150 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md',
                  index % 2 === 0
                    ? 'bg-gray-50 dark:bg-gray-800'
                    : 'bg-white dark:bg-gray-900',
                  row.original.rank <= 3 && 'border-l-[3px] border-l-blue-600'
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'py-4 px-6',
                      cell.column.columnDef.meta?.className
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards, <680px */}
      <div className="flex flex-col gap-2.5 bbc:hidden">
        {data.map(p => (
          <div
            key={p.playerId}
            className={cn(
              'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow p-3',
              p.rank <= 3 && 'border-l-[3px] border-l-blue-600'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-heading font-bold text-xl w-7 text-center shrink-0 text-blue-600">{p.rank}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 truncate">{p.playerName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{p.appearances} apps</span>
                  <MedalBadge type="gold" count={p.goldMedals} />
                  <MedalBadge type="silver" count={p.silverMedals} />
                  <MedalBadge type="bronze" count={p.bronzeMedals} />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Avg PF {p.avgPointsFor.toFixed(1)} · Avg PA {p.avgPointsAgainst.toFixed(1)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-heading font-bold text-lg text-gray-900 dark:text-gray-100">{p.avgPointsTotal.toFixed(1)}</div>
                <div className="text-[11px] font-semibold text-green-600">{p.totPrizeMoney.toLocaleString()} kr</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
