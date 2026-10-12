'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SHBControl } from './SHBControl'
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
      <TableCell className="font-mono text-[11px] text-gray-700 dark:text-gray-300">{product.rawName}</TableCell>
      <TableCell>
        <Input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="not reviewed"
          className="h-7 text-[13px]"
        />
      </TableCell>
      <TableCell>
        <Input
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="—"
          className="h-7 text-[11.5px]"
        />
      </TableCell>
      <TableCell className="font-mono text-right">{product.count}</TableCell>
      <TableCell className="font-mono text-right text-gray-500 dark:text-gray-400">
        {formatQuantity(product.quantityKg, product.quantitySt)}
      </TableCell>
      <TableCell className="font-mono text-right">{kr(product.total)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end">
          <SHBControl
            activeValue={product.defaultConsumer}
            onSelect={val => onSelectDefault(product.rawName, val)}
            onClear={() => onClearDefault(product.rawName)}
          />
        </div>
      </TableCell>
      <TableCell className="text-right">
        {dirty && (
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="outline" onClick={handleDiscard} disabled={saving}>
              Discard
            </Button>
            <Button size="xs" variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-gray-600 dark:text-gray-400 max-w-[720px]">
        A default only seeds new receipt lines the next time this product is imported from
        Kivra — it never changes anything already on the site. To fix a product&apos;s consumer on
        past receipts, edit the affected lines directly in the Receipts tab.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search raw_name, display_name or category"
          className="flex-1 min-w-[220px]"
        />
        <Button variant="outline" onClick={() => setUnrevOnly(v => !v)}>
          {unrevOnly ? 'Showing: no default' : 'Only without default'}
        </Button>
        <Button variant="outline" onClick={() => setMissingDisplayName(v => !v)}>
          {missingDisplayName ? 'Showing: no display name' : 'Only without display name'}
        </Button>
        <Button variant="outline" onClick={() => setExcludeNegative(v => !v)}>
          {excludeNegative ? 'Hiding negative totals' : 'Showing all (incl. negative)'}
        </Button>
      </div>

      {!loading && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[9.5px] uppercase tracking-[0.07em] text-gray-400">raw_name</TableHead>
                <TableHead className="font-mono text-[9.5px] uppercase tracking-[0.07em] text-gray-400">display_name</TableHead>
                <TableHead className="font-mono text-[9.5px] uppercase tracking-[0.07em] text-gray-400">category</TableHead>
                <TableHead className="font-mono text-[9.5px] uppercase tracking-[0.07em] text-gray-400 text-right">n</TableHead>
                <TableHead className="font-mono text-[9.5px] uppercase tracking-[0.07em] text-gray-400 text-right">qty</TableHead>
                <TableHead className="font-mono text-[9.5px] uppercase tracking-[0.07em] text-gray-400 text-right">total</TableHead>
                <TableHead className="font-mono text-[9.5px] uppercase tracking-[0.07em] text-gray-400 text-right">default</TableHead>
                <TableHead className="font-mono text-[9.5px] uppercase tracking-[0.07em] text-gray-400 text-right"></TableHead>
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
                  <TableCell colSpan={8} className="text-center text-gray-400 py-6">
                    No products match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
