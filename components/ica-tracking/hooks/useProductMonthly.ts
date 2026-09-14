import { useEffect, useState } from 'react'
import type { ProductMonthlyResponse, ProductOptionsResponse } from '../types'
import { fetchJson } from './useMonths'

export function useProductOptions() {
  const [data, setData] = useState<ProductOptionsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function run() {
      const result = await fetchJson<ProductOptionsResponse>('/api/ica-tracking/products/options')
      setData(result)
      setLoading(false)
    }
    run()
  }, [])

  return { data, loading }
}

/** Sums the selected products (by display_name) into one combined monthly
 * series. `names` order doesn't matter for the request, so the effect keys
 * off a sorted, joined string rather than the array reference — a fresh
 * array of the same names (e.g. from Array.from(aSet)) shouldn't refetch. */
export function useProductMonthly(names: string[]) {
  const [data, setData] = useState<ProductMonthlyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const key = [...names].sort().join(' ')

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (names.length === 0) {
        setData(null)
        return
      }
      setLoading(true)
      try {
        const res = await fetch('/api/ica-tracking/products/monthly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names }),
        })
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const result = (await res.json()) as ProductMonthlyResponse
        if (!cancelled) setData(result)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()

    return () => {
      cancelled = true
    }
    // `names` is intentionally represented by `key` above, not itself, so a
    // same-content-different-reference array doesn't trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data, loading }
}
