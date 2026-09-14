'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { kr } from './colors'
import type { ProductOption } from './types'

interface CategoryGroup {
  name: string
  total: number
  products: ProductOption[]
}

function buildGroups(options: ProductOption[]): CategoryGroup[] {
  const map = new Map<string, ProductOption[]>()
  for (const o of options) {
    const list = map.get(o.category) ?? []
    list.push(o)
    map.set(o.category, list)
  }
  const groups = [...map.entries()].map(([name, products]) => ({
    name,
    products: [...products].sort((a, b) => b.total - a.total),
    total: products.reduce((sum, p) => sum + p.total, 0),
  }))
  groups.sort((a, b) => b.total - a.total)
  return groups
}

interface ProductSelectorProps {
  options: ProductOption[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

export function ProductSelector({ options, selected, onChange }: ProductSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => buildGroups(options), [options])
  const allNames = useMemo(() => options.map(o => o.name), [options])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const q = query.trim().toLowerCase()
  const visibleGroups = q
    ? groups
        .map(g => ({
          ...g,
          products: g.name.toLowerCase().includes(q) ? g.products : g.products.filter(p => p.name.toLowerCase().includes(q)),
        }))
        .filter(g => g.products.length > 0)
    : groups

  const allSelected = allNames.length > 0 && allNames.every(n => selected.has(n))
  const noneSelected = selected.size === 0

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(allNames))
  }

  function toggleCategory(group: CategoryGroup) {
    const names = group.products.map(p => p.name)
    const allIn = names.every(n => selected.has(n))
    const next = new Set(selected)
    if (allIn) names.forEach(n => next.delete(n))
    else names.forEach(n => next.add(n))
    onChange(next)
  }

  function toggleProduct(name: string) {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    onChange(next)
  }

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const allExpanded = groups.length > 0 && groups.every(g => expanded.has(g.name))

  function toggleExpandAll() {
    setExpanded(allExpanded ? new Set() : new Set(groups.map(g => g.name)))
  }

  const summary = noneSelected
    ? 'No products selected'
    : allSelected
      ? 'All products'
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} products selected`

  return (
    <div ref={containerRef} className="relative min-w-[220px] max-w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="h-8 w-full min-w-[220px] flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-600 rounded-[10px] px-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900"
      >
        <span className="truncate">{summary}</span>
        <span className="text-gray-400 text-xs shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 left-0 z-20 mt-1 w-[320px] max-w-[90vw] rounded-[10px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-[0_10px_15px_-3px_rgba(17,24,39,0.14)] flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products or categories…"
              className="h-8"
            />
          </div>

          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="accent-gray-900 dark:accent-gray-100"
              />
              Select all
            </label>
            <button
              type="button"
              onClick={toggleExpandAll}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {visibleGroups.length === 0 && <div className="px-3 py-4 text-sm text-gray-400">No matches</div>}
            {visibleGroups.map(group => {
              const names = group.products.map(p => p.name)
              const catAllSelected = names.every(n => selected.has(n))
              const catSomeSelected = !catAllSelected && names.some(n => selected.has(n))
              // While searching, a matching category's products should stay
              // visible regardless of its collapsed state — otherwise typing
              // a query into a collapsed-by-default list would hide results.
              const isOpen = q !== '' || expanded.has(group.name)
              return (
                <div key={group.name}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-white/5">
                    <input
                      type="checkbox"
                      checked={catAllSelected}
                      ref={el => {
                        if (el) el.indeterminate = catSomeSelected
                      }}
                      onChange={() => toggleCategory(group)}
                      className="accent-gray-900 dark:accent-gray-100 shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpand(group.name)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <span
                        className={cn(
                          'text-gray-400 text-[9px] transition-transform shrink-0',
                          isOpen && 'rotate-90'
                        )}
                      >
                        ▶
                      </span>
                      <span className="text-xs font-mono uppercase tracking-[0.05em] text-gray-500 dark:text-gray-400 truncate">
                        {group.name}
                      </span>
                    </button>
                    <span className="font-mono text-[11px] text-gray-400 shrink-0">{kr(group.total)}</span>
                  </div>
                  {isOpen && group.products.map(p => (
                    <label
                      key={p.name}
                      className="flex items-center gap-2 pl-7 pr-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.name)}
                        onChange={() => toggleProduct(p.name)}
                        className="accent-gray-900 dark:accent-gray-100"
                      />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-mono text-[11px] text-gray-400">{kr(p.total)}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end p-2 border-t border-gray-100 dark:border-gray-700">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
