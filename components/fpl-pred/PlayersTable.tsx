'use client'

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { NativeSelect } from '@/components/ui/native-select'
import { SectionHeading } from '@/components/SectionHeading'
import { MetricGroup, quietItemProps } from '@/components/ui/Motion'
import { cn } from '@/lib/utils'
import { doubtful } from './PlayerCard'
import type { PlayersPlayer } from './types'

type Position = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD'
const POSITIONS: { value: Position; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'GKP', label: 'GKP' },
  { value: 'DEF', label: 'DEF' },
  { value: 'MID', label: 'MID' },
  { value: 'FWD', label: 'FWD' },
]
const SORTABLE = new Set(['web_name', 'chance', 'adjusted_xpts'])
const TOP_N = 15

const MotionRow = motion.create(TableRow)

export default function PlayersTable({
  players,
  predictionsAvailable,
  loading,
  error,
  gameweek,
  myCodes,
  opponentCodes,
}: {
  players: PlayersPlayer[]
  predictionsAvailable: boolean
  loading: boolean
  error: string | null
  gameweek: number | null
  myCodes: Set<number>
  opponentCodes: Set<number>
}) {
  const [positionFilter, setPositionFilter] = useState<Position>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'adjusted_xpts', desc: true }])

  const teams = useMemo(() => Array.from(new Set(players.map(p => p.team))).sort(), [players])
  const top = useMemo(() => Math.max(0, ...players.map(p => p.adjusted_xpts ?? 0)), [players])
  const free = players.filter(p => p.available).length

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
      { id: 'rank', header: '#' }, // numbered in the render loop, after sorting
      {
        accessorKey: 'web_name',
        header: 'Player',
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <span title={row.original.name} className="truncate font-medium">{row.original.web_name}</span>
            {myCodes.has(row.original.code) && <span className="size-1.5 flex-none rounded-full bg-accent" />}
          </span>
        ),
      },
      { accessorKey: 'team', header: 'Club' },
      { accessorKey: 'position', header: 'Pos' },
      {
        id: 'chance',
        // No news counts as fit, as on the pitch.
        accessorFn: p => p.chance_of_playing ?? 100,
        header: 'Chance',
        cell: ({ row }) => {
          const v = row.original.chance_of_playing
          return <span className={doubtful(row.original) ? 'text-warn' : 'text-ink-3'}>{v !== null ? `${v}%` : '–'}</span>
        },
      },
      {
        accessorKey: 'adjusted_xpts',
        header: 'xPts',
        cell: ({ row }) => {
          const v = row.original.adjusted_xpts
          return (
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-surface-3">
                <span
                  className={cn('block h-full rounded-[3px]', myCodes.has(row.original.code) ? 'bg-accent' : 'bg-series-muted')}
                  style={{ width: `${top > 0 && v !== null ? (Math.max(v, 0) / top) * 100 : 0}%` }}
                />
              </span>
              <span className="w-[34px] text-right text-sm font-medium text-ink">{v !== null ? v.toFixed(1) : '–'}</span>
            </span>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const p = row.original
          if (p.available) return <span className="text-ink">Available</span>
          if (myCodes.has(p.code)) return <span className="text-ink-3">Your team</span>
          if (opponentCodes.has(p.code)) return <span className="text-ink-3">Opponent</span>
          return <span className="text-ink-3">Owned</span>
        },
      },
    ],
    [myCodes, opponentCodes, top]
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows
  const shown = showAll ? rows : rows.slice(0, TOP_N)
  const resetPaging = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShowAll(false) }

  const caption = predictionsAvailable
    ? `${players.length} players in the league's pool, ${free} available. ${gameweek ? `Gameweek ${gameweek} predictions` : 'Predictions'} with chance of playing applied.${myCodes.size ? ' Your players are highlighted.' : ''}`
    : undefined

  return (
    <section>
      <SectionHeading title="Players" caption={caption} />

      {loading && <p className="text-sm text-ink-3">Loading players…</p>}
      {error && <p role="alert" className="text-[13px] text-neg">Couldn&apos;t load the players: {error}</p>}
      {!loading && !error && !predictionsAvailable && (
        <p className="rounded-[10px] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
          No predictions yet for the next gameweek. They appear once the model has run.
        </p>
      )}

      {!loading && !error && predictionsAvailable && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <Segmented label="Position" size="sm" options={POSITIONS} value={positionFilter} onChange={resetPaging(setPositionFilter)} />
            <NativeSelect variant="pill" aria-label="Club" value={teamFilter} onChange={e => resetPaging(setTeamFilter)(e.target.value)}>
              <option value="all">All clubs</option>
              {teams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </NativeSelect>
            <button
              type="button"
              aria-pressed={availableOnly}
              onClick={() => resetPaging(setAvailableOnly)(!availableOnly)}
              className={cn(
                'h-8 cursor-pointer rounded-full border px-3.5 text-[13px] whitespace-nowrap',
                availableOnly ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong text-ink-2'
              )}
            >
              Available only
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <Table className="min-w-[800px] table-fixed">
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="w-[124px]" />
                <col className="w-14" />
                <col className="w-20" />
                <col className="w-[180px]" />
                <col className="w-[120px]" />
              </colgroup>
              <TableHeader>
                {table.getHeaderGroups().map(hg => (
                  <TableRow key={hg.id}>
                    {hg.headers.map(header => {
                      const sorted = header.column.getIsSorted()
                      const right = header.id === 'chance'
                      return (
                        <TableHead
                          key={header.id}
                          aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                          className={cn('first:pl-5 last:pr-5', right && 'text-right')}
                        >
                          {SORTABLE.has(header.id) ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className={cn('cursor-pointer uppercase', sorted ? 'text-ink' : 'text-ink-3')}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === 'asc' ? ' ↑' : sorted === 'desc' ? ' ↓' : ''}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <MetricGroup as="tbody" stagger={0.03}>
                {shown.map((row, i) => (
                  <MotionRow
                    key={row.id}
                    {...quietItemProps}
                    data-state={myCodes.has(row.original.code) ? 'selected' : undefined}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'first:pl-5 last:pr-5',
                          cell.column.id === 'rank' && 'font-mono text-xs text-ink-3',
                          (cell.column.id === 'team' || cell.column.id === 'position') && 'truncate font-mono text-xs text-ink-2',
                          cell.column.id === 'chance' && 'text-right font-mono text-[13px]',
                          cell.column.id === 'adjusted_xpts' && 'font-mono',
                          cell.column.id === 'status' && 'truncate text-[13px]'
                        )}
                      >
                        {cell.column.id === 'rank' ? i + 1 : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </MotionRow>
                ))}
              </MetricGroup>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
              <span className="text-xs text-ink-3">Showing {shown.length} of {rows.length}</span>
              {rows.length > TOP_N && (
                <Button variant="secondary" size="sm" onClick={() => setShowAll(!showAll)}>
                  {showAll ? `Show top ${TOP_N}` : `Show all ${rows.length}`}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
