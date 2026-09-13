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

export function useProductMonthly(name: string | null) {
  const [data, setData] = useState<ProductMonthlyResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!name) {
        setData(null)
        return
      }
      setLoading(true)
      try {
        const result = await fetchJson<ProductMonthlyResponse>(
          `/api/ica-tracking/products/monthly?name=${encodeURIComponent(name)}`
        )
        if (!cancelled) setData(result)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()

    return () => {
      cancelled = true
    }
  }, [name])

  return { data, loading }
}
