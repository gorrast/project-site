'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SHBControl } from './SHBControl'
import { cn } from '@/lib/utils'
import { useProducts } from './hooks/useProducts'
import { formatQuantity, kr } from './colors'
import type { Consumer, ProductRow } from './types'

interface ProductTableRowProps {
  product: ProductRow
  onSaveDetails: (rawName: string, displayName: string | null, category: string | null) => Promise<void>
  onSelectDefault: (rawName: string, value: Consumer) => void
  onClearDefault: (rawName: string) => void
}

function ProductTableRowView({ product, onSaveDetails, onSelectDefault, onClearDefault }: ProductTableRowProps) {
  const [displayName, setDisplayName] = useState(product.displayName ?? '')
  const [category, setCategory] = useState(product.category ?? '')
  const [saving, setSaving] = useState(false)

  // A fresh value from the server (after a successful save, or a refetch)
  // resets the local draft — but only when the underlying value actually
  // changes, so typing isn't clobbered by unrelated re-renders (e.g. a
  // different row's default_consumer changing re-creates every row object).
  useEffect(() => {
    function run() {
      setDisplayName(product.displayName ?? '')
      setCategory(product.category ?? '')
    }
    run()
  }, [product.displayName, product.category])

  const dirty =
    displayName.trim() !== (product.displayName ?? '') || category.trim() !== (product.category ?? '')

  async function handleSave() {
    setSaving(true)
    await onSaveDetails(product.rawName, displayName.trim() || null, category.trim() || null)
    setSaving(false)
  }

  function handleDiscard() {
    setDisplayName(product.displayName ?? '')
    setCategory(product.category ?? '')
  }

  return (
    <TableRow>
      <TableCell className="truncate pl-5 font-mono text-xs text-ink-2" title={product.rawName}>{product.rawName}</TableCell>
      <TableCell>
        <Input
          aria-label={`Display name for ${product.rawName}`}
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="not reviewed"
          className="h-8 text-[13px]"
        />
      </TableCell>
      <TableCell>
        <Input
          aria-label={`Category for ${product.rawName}`}
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="–"
          className="h-8 text-[13px]"
        />
      </TableCell>
      <TableCell className="text-right font-mono text-[13px] text-ink-2">{product.count || '–'}</TableCell>
      <TableCell className="truncate text-right font-mono text-xs text-ink-3">
        {formatQuantity(product.quantityKg, product.quantitySt)}
      </TableCell>
      <TableCell className="text-right font-mono text-[13px]">{product.count ? kr(product.total) : '–'}</TableCell>
      <TableCell>
        <div className="flex justify-end">
          <SHBControl
            label={`Default for ${product.displayName ?? product.rawName}`}
            activeValue={product.defaultConsumer}
            onSelect={val => onSelectDefault(product.rawName, val)}
            onClear={() => onClearDefault(product.rawName)}
          />
        </div>
      </TableCell>
      <TableCell className="pr-5">
        {dirty && (
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={handleDiscard} disabled={saving}>
              Discard
            </Button>
            <Button size="xs" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'h-10 cursor-pointer rounded-full border px-4 text-[13px] whitespace-nowrap',
        pressed ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong text-ink-2'
      )}
    >
      {children}
    </button>
  )
}

export function ProductsTable() {
  const { data, loading, setDefaultConsumer, setProductDetails } = useProducts()
  const [query, setQuery] = useState('')
  const [unrevOnly, setUnrevOnly] = useState(false)
  const [missingDisplayName, setMissingDisplayName] = useState(false)
  const [excludeNegative, setExcludeNegative] = useState(true)

  const rows = useMemo(() => {
    let rows = data?.products ?? []
    if (excludeNegative) rows = rows.filter(p => p.total >= 0)
    if (unrevOnly) rows = rows.filter(p => !p.defaultConsumer)
    if (missingDisplayName) rows = rows.filter(p => !p.displayName)
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(p =>
        `${p.rawName} ${p.displayName ?? ''} ${p.category ?? ''}`.toLowerCase().includes(q)
      )
    }
    return rows
  }, [data, query, unrevOnly, missingDisplayName, excludeNegative])

  const all = data?.products ?? []
  const withoutDefault = all.filter(p => !p.defaultConsumer).length

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[720px] text-sm leading-relaxed text-ink-2">
        A product&apos;s default decides who new lines of it belong to in future imports from Kivra. It doesn&apos;t
        change receipts already on the site; fix those line by line under Receipts. Totals cover every month and
        leave out excluded receipts.
      </p>

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-[1_1_260px] flex-col gap-1.5">
          <span className="text-[13px] font-medium">Search products</span>
          <Input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Raw name, display name or category" />
        </label>
        <Chip pressed={unrevOnly} onClick={() => setUnrevOnly(v => !v)}>Only without a default</Chip>
        <Chip pressed={missingDisplayName} onClick={() => setMissingDisplayName(v => !v)}>Only without a display name</Chip>
        <Chip pressed={!excludeNegative} onClick={() => setExcludeNegative(v => !v)}>Include negative totals</Chip>
      </div>

      {loading && <p className="text-sm text-ink-3">Loading products…</p>}
      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <Table className="min-w-[980px] table-fixed">
            <colgroup>
              <col />
              <col className="w-[200px]" />
              <col className="w-[150px]" />
              <col className="w-12" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[120px]" />
              <col className="w-[150px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Raw name</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">n</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Default</TableHead>
                <TableHead className="pr-5"><span className="sr-only">Save</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(p => (
                <ProductTableRowView
                  key={p.rawName}
                  product={p}
                  onSaveDetails={setProductDetails}
                  onSelectDefault={(rawName, val) => setDefaultConsumer(rawName, val)}
                  onClearDefault={rawName => setDefaultConsumer(rawName, null)}
                />
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-ink-3">
                    No products match. Clear the search or a filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="border-t border-line px-5 py-3 text-xs text-ink-3">
            {rows.length} of {all.length} products · {withoutDefault} without a default
          </div>
        </div>
      )}
    </div>
  )
}
