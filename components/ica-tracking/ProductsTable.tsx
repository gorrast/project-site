'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SHBControl } from './SHBControl'
import { useProducts } from './hooks/useProducts'
import { formatQuantity, kr } from './colors'

export function ProductsTable() {
  const { data, loading, setDefaultConsumer } = useProducts()
  const [query, setQuery] = useState('')
  const [unrevOnly, setUnrevOnly] = useState(false)

  const rows = useMemo(() => {
    let rows = data?.products ?? []
    if (unrevOnly) rows = rows.filter(p => !p.defaultConsumer)
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(p =>
        `${p.rawName} ${p.displayName ?? ''} ${p.category ?? ''}`.toLowerCase().includes(q)
      )
    }
    return rows
  }, [data, query, unrevOnly])

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(p => (
                <TableRow key={p.rawName}>
                  <TableCell className="font-mono text-[11px] text-gray-700 dark:text-gray-300">{p.rawName}</TableCell>
                  <TableCell className="text-[13px]">
                    {p.displayName ?? <span className="text-gray-400">not reviewed</span>}
                  </TableCell>
                  <TableCell className="text-[11.5px] text-gray-500 dark:text-gray-400">{p.category ?? '—'}</TableCell>
                  <TableCell className="font-mono text-right">{p.count}</TableCell>
                  <TableCell className="font-mono text-right text-gray-500 dark:text-gray-400">
                    {formatQuantity(p.quantityKg, p.quantitySt)}
                  </TableCell>
                  <TableCell className="font-mono text-right">{kr(p.total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <SHBControl
                        activeValue={p.defaultConsumer}
                        onSelect={val => setDefaultConsumer(p.rawName, val)}
                        onClear={() => setDefaultConsumer(p.rawName, null)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-6">
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
