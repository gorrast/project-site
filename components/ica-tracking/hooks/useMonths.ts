import { useCallback, useEffect, useState } from 'react'
import type { MonthsResponse } from '../types'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error((body && body.error) || `Request failed (${res.status})`)
  }
  return res.json()
}

export function useMonths() {
  const [data, setData] = useState<MonthsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const result = await fetchJson<MonthsResponse>('/api/ica-tracking/months')
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

  return { data, loading, error, refetch }
}

export { fetchJson }
