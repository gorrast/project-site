'use client'

import React from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { PlayPilotRating } from './types'

interface TitleListProps {
  ratings: PlayPilotRating[]
  selectedRating: number | null
  onClearRating: () => void
}

const TYPE_LABELS: Record<'movie' | 'series', string> = {
  movie: 'Movie',
  series: 'TV',
}

export default function TitleList({ ratings, selectedRating, onClearRating }: TitleListProps) {
  const sorted = [...ratings].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 sm:p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Rated Titles
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({sorted.length})
          </span>
        </h3>
        {selectedRating !== null && (
          <button
            onClick={onClearRating}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/70 transition-colors cursor-pointer"
          >
            Rating {selectedRating} × clear
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No titles match the current filters.</p>
      ) : (
        <div className="max-h-[480px] overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700">
          <Table>
            <TableHeader className="sticky top-0 bg-white dark:bg-gray-800 z-10">
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Genres</TableHead>
                <TableHead className="text-right">Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((rating, i) => (
                <TableRow key={`${rating.title}-${i}`}>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100 whitespace-normal">
                    {rating.title}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {rating.type ? TYPE_LABELS[rating.type] : '—'}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {rating.year ?? '—'}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400 whitespace-normal">
                    {rating.genres.length > 0 ? rating.genres.join(', ') : '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-purple-600 dark:text-purple-400">
                    {rating.score}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
