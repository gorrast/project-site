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
import { PlayerSeasonStats } from './types'
import { FormRow } from './FormChip'

interface SeasonTableProps {
  data: PlayerSeasonStats[]
  seasonName: string
}

function luckClass(val: number) {
  return val > 1 ? 'text-green-600' : val < 1 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'
}

const columns: ColumnDef<PlayerSeasonStats>[] = [
  {
    accessorKey: 'rank',
    header: 'Rank',
    cell: ({ getValue }) => (
      <span className="font-heading font-bold text-lg text-green-600">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: 'playerName',
    header: 'Player',
    cell: ({ getValue }) => (
      <span className="font-semibold text-gray-900 dark:text-gray-100">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'totalPoints',
    header: 'Points',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => (
      <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: 'wins',
    header: 'W',
    meta: { className: 'text-center' },
  },
  {
    accessorKey: 'draws',
    header: 'D',
    meta: { className: 'text-center' },
  },
  {
    accessorKey: 'losses',
    header: 'L',
    meta: { className: 'text-center' },
  },
  {
    accessorKey: 'pointsFor',
    header: 'PF',
    meta: { className: 'text-center' },
  },
  {
    accessorKey: 'pointsAgainst',
    header: 'PA',
    meta: { className: 'text-center' },
  },
  {
    accessorKey: 'form',
    header: 'Form',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => {
      const form = getValue<PlayerSeasonStats['form']>()
      return (
        <FormRow
          entries={form.map(f => ({
            result: f.result,
            title: `${f.result} vs ${f.opponentPlayerName} (${f.myScore}-${f.oppScore})`,
          }))}
        />
      )
    },
  },
  {
    accessorKey: 'luckFactor',
    header: 'Luck',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => {
      const val = getValue<number>()
      return <span className={cn('font-bold text-lg', luckClass(val))}>{val.toFixed(2)}</span>
    },
  },
]

export default function SeasonTable({ data, seasonName }: SeasonTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="w-full">
      <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">{seasonName} Standings</h3>

      {/* Desktop: full table, >=680px */}
      <div className="hidden bbc:block rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-linear-to-r from-green-600 to-emerald-600">
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="border-0 hover:bg-transparent has-aria-expanded:bg-transparent">
                {hg.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'py-4 px-6 text-white font-bold text-sm uppercase tracking-wider',
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
                  'transition-all duration-150 hover:bg-green-50 dark:hover:bg-green-900/20',
                  index % 2 === 0
                    ? 'bg-gray-50 dark:bg-gray-800'
                    : 'bg-white dark:bg-gray-900',
                  row.original.rank <= 3 && 'border-l-[3px] border-l-green-600'
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'py-4 px-6 text-gray-700 dark:text-gray-300',
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
              p.rank <= 3 && 'border-l-[3px] border-l-green-600'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-heading font-bold text-xl w-7 text-center shrink-0 text-green-600">{p.rank}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 truncate">{p.playerName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {p.wins}W {p.draws}D {p.losses}L · PF {p.pointsFor} · PA {p.pointsAgainst}
                </div>
                <div className="mt-1.5">
                  <FormRow
                    entries={p.form.map(f => ({
                      result: f.result,
                      title: `${f.result} vs ${f.opponentPlayerName} (${f.myScore}-${f.oppScore})`,
                    }))}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-heading font-bold text-lg text-gray-900 dark:text-gray-100">{p.totalPoints}</div>
                <div className={cn('text-[11px] font-semibold', luckClass(p.luckFactor))}>luck {p.luckFactor.toFixed(2)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
