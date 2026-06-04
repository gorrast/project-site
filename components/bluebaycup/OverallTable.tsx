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

interface OverallTableProps {
  data: PlayerOverallStats[]
}

type MedalType = 'gold' | 'silver' | 'bronze'

function medalClass(value: number, type: MedalType) {
  if (value === 0) return 'text-gray-400'
  if (type === 'gold') return 'text-yellow-500 font-bold'
  if (type === 'silver') return 'text-gray-400 font-bold'
  return 'text-amber-700 font-bold'
}

const columns: ColumnDef<PlayerOverallStats>[] = [
  {
    accessorKey: 'rank',
    header: 'Rank',
    cell: ({ getValue }) => (
      <span className="font-bold text-xl text-blue-600">{getValue<number>()}</span>
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
    meta: { className: 'text-center hidden md:table-cell' },
    cell: ({ getValue }) => (
      <span className="font-semibold text-gray-700 dark:text-gray-300">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: 'goldMedals',
    header: '🥇',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => {
      const val = getValue<number>()
      return <span className={cn('text-xl', medalClass(val, 'gold'))}>{val === 0 ? '-' : val}</span>
    },
  },
  {
    accessorKey: 'silverMedals',
    header: '🥈',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => {
      const val = getValue<number>()
      return <span className={cn('text-xl', medalClass(val, 'silver'))}>{val === 0 ? '-' : val}</span>
    },
  },
  {
    accessorKey: 'bronzeMedals',
    header: '🥉',
    meta: { className: 'text-center' },
    cell: ({ getValue }) => {
      const val = getValue<number>()
      return <span className={cn('text-xl', medalClass(val, 'bronze'))}>{val === 0 ? '-' : val}</span>
    },
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
    meta: { className: 'text-center hidden md:table-cell' },
    cell: ({ getValue }) => (
      <span className="text-gray-700 dark:text-gray-300">{getValue<number>().toFixed(1)}</span>
    ),
  },
  {
    accessorKey: 'avgPointsAgainst',
    header: 'Avg. PA',
    meta: { className: 'text-center hidden md:table-cell' },
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
    <div className="w-full rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
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
                  : 'bg-white dark:bg-gray-900'
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
  )
}
