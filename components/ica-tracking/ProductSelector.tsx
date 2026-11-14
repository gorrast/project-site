'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
        aria-expanded={open}
        className="flex h-10 w-full min-w-[220px] cursor-pointer items-center justify-between gap-2 rounded-full border border-line-strong bg-surface pr-3 pl-4 text-sm font-medium text-ink"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 flex w-[320px] max-w-[calc(100vw-32px)] flex-col rounded-xl border border-line-strong bg-surface shadow-(--shadow-pop)">
          <div className="border-b border-line p-2">
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search products or categories"
              placeholder="Search products or categories…"
              className="h-9"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 accent-(--accent)"
              />
              Select all
            </label>
            <button
              type="button"
              onClick={toggleExpandAll}
              className="cursor-pointer text-xs text-ink-3 hover:text-ink"
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {visibleGroups.length === 0 && <div className="px-3 py-4 text-sm text-ink-3">No products or categories match.</div>}
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
                  <div className="flex items-center gap-2 bg-surface-2 px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={catAllSelected}
                      ref={el => {
                        if (el) el.indeterminate = catSomeSelected
                      }}
                      onChange={() => toggleCategory(group)}
                      aria-label={`All of ${group.name}`}
                      className="size-4 shrink-0 accent-(--accent)"
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpand(group.name)}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
                    >
                      <ChevronRight className={cn('size-3 shrink-0 text-ink-3 transition-transform', isOpen && 'rotate-90')} />
                      <span className="truncate font-mono text-[11px] tracking-[0.06em] text-ink-2 uppercase">
                        {group.name}
                      </span>
                    </button>
                    <span className="shrink-0 font-mono text-[11px] text-ink-3">{kr(group.total)}</span>
                  </div>
                  {isOpen && group.products.map(p => (
                    <label
                      key={p.name}
                      className="flex cursor-pointer items-center gap-2 py-1.5 pr-3 pl-7 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.name)}
                        onChange={() => toggleProduct(p.name)}
                        className="size-4 accent-(--accent)"
                      />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-mono text-[11px] text-ink-3">{kr(p.total)}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end border-t border-line p-2">
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
