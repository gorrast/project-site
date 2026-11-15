'use client'

import React from 'react'
import { X } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { NativeSelect } from '@/components/ui/native-select'
import { SectionHeading } from '@/components/SectionHeading'
import { PlayPilotRating } from './types'

interface TitleListProps {
  ratings: PlayPilotRating[]
  selectedRating: number | null
  onSelectRating: (score: number | null) => void
}

const TYPE_LABELS: Record<'movie' | 'series', string> = {
  movie: 'Film',
  series: 'TV',
}

export default function TitleList({ ratings, selectedRating, onSelectRating }: TitleListProps) {
  const sorted = [...ratings].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))

  return (
    <>
      <SectionHeading
        title="Rated titles"
        caption={`${sorted.length} titles${selectedRating !== null ? ` rated ${selectedRating}` : ''}, highest rated first.`}
      >
        <div className="flex items-center gap-2.5">
          {selectedRating !== null && (
            <button
              type="button"
              onClick={() => onSelectRating(null)}
              aria-label={`Clear rating ${selectedRating} filter`}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3.5 text-[13px] text-ink"
            >
              Rating {selectedRating}
              <X className="size-3.5" aria-hidden />
            </button>
          )}
          <NativeSelect
            aria-label="Rating"
            variant="pill"
            value={selectedRating ?? ''}
            onChange={e => onSelectRating(e.target.value ? Number(e.target.value) : null)}
            className="w-[150px]"
          >
            <option value="">All ratings</option>
            {Array.from({ length: 10 }, (_, i) => 10 - i).map(n => (
              <option key={n} value={n}>
                Rating {n}
              </option>
            ))}
          </NativeSelect>
        </div>
      </SectionHeading>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-ink-3">
          No titles match this type and rating. Pick another rating or clear the filter.
        </p>
      ) : (
        // shortcut: the header scrolls away with the rows (Table's overflow-x wrapper defeats sticky); fine for a prototype.
        <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-line bg-surface">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-right">Rating</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Year</TableHead>
                <TableHead>Genres</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((rating, i) => (
                <TableRow key={`${rating.title}-${i}`}>
                  <TableCell className="text-right font-mono font-medium tabular-nums">{rating.score}</TableCell>
                  <TableCell className="font-medium whitespace-normal">{rating.title}</TableCell>
                  <TableCell className="text-ink-2">{rating.type ? TYPE_LABELS[rating.type] : '–'}</TableCell>
                  <TableCell className="text-right font-mono text-ink-2 tabular-nums">{rating.year ?? '–'}</TableCell>
                  <TableCell className="whitespace-normal text-ink-2">
                    {rating.genres.length > 0 ? rating.genres.join(', ') : '–'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
