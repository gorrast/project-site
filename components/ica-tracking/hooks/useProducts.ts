import { useCallback, useEffect, useState } from 'react'
import type { Consumer, ProductsResponse } from '../types'
import { fetchJson } from './useMonths'

export function useProducts() {
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const result = await fetchJson<ProductsResponse>('/api/ica-tracking/products')
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const setDefaultConsumer = useCallback(async (rawName: string, defaultConsumer: Consumer | null) => {
    setSaveError(null)
    setData(prev =>
      prev
        ? {
            products: prev.products.map(p => (p.rawName === rawName ? { ...p, defaultConsumer } : p)),
          }
        : prev
    )
    try {
      const res = await fetch('/api/ica-tracking/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawName, defaultConsumer }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setSaveError('Failed to save — reverted')
      refetch()
    }
  }, [refetch])

  return { data, loading, error, saveError, refetch, setDefaultConsumer }
}
