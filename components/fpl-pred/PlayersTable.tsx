'use client'

import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PlayersPlayer } from './types'

const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD']

function sortIndicator(sorted: false | 'asc' | 'desc') {
  if (sorted === 'asc') return ' ↑'
  if (sorted === 'desc') return ' ↓'
  return ''
}

export default function PlayersTable({
  players,
  predictionsAvailable,
  loading,
  error,
}: {
  players: PlayersPlayer[]
  predictionsAvailable: boolean
  loading: boolean
  error: string | null
}) {
  const [positionFilter, setPositionFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'adjusted_xpts', desc: true }])

  const teams = useMemo(() => Array.from(new Set(players.map(p => p.team))).sort(), [players])

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (positionFilter !== 'all' && p.position !== positionFilter) return false
      if (teamFilter !== 'all' && p.team !== teamFilter) return false
      if (availableOnly && !p.available) return false
      return true
    })
  }, [players, positionFilter, teamFilter, availableOnly])

  const columns = useMemo<ColumnDef<PlayersPlayer>[]>(
    () => [
      { accessorKey: 'name', header: 'Player' },
      { accessorKey: 'team', header: 'Team' },
      { accessorKey: 'position', header: 'Pos' },
      {
        accessorKey: 'adjusted_xpts',
        header: 'xPts',
        cell: ({ getValue }) => {
          const v = getValue<number | null>()
          return v !== null ? v.toFixed(1) : '—'
        },
      },
      {
        accessorKey: 'chance_of_playing',
        header: 'Chance',
        cell: ({ getValue }) => {
          const v = getValue<number | null>()
          return v !== null ? `${v}%` : '—'
        },
      },
      {
        accessorKey: 'available',
        header: 'Status',
        cell: ({ getValue }) => (
          <span
            className={
              getValue<boolean>()
                ? 'text-green-600 dark:text-green-400 font-semibold'
                : 'text-gray-400 dark:text-gray-500'
            }
          >
            {getValue<boolean>() ? 'Available' : 'Owned'}
          </span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100 mr-auto">Players</h2>
        <select
          value={positionFilter}
          onChange={e => setPositionFilter(e.target.value)}
          className="text-sm px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All positions</option>
          {POSITIONS.map(pos => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="text-sm px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All teams</option>
          {teams.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} />
          Available only
        </label>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && !predictionsAvailable && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          No predictions available yet for the next gameweek.
        </p>
      )}
      {!loading && !error && predictionsAvailable && (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id}>
                  {hg.headers.map(header => (
                    <TableHead
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none whitespace-nowrap"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortIndicator(header.column.getIsSorted())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
