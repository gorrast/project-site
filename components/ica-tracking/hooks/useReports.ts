import { useEffect, useState } from 'react'
import type { PersonFilter, ReportsResponse, Scope } from '../types'
import { fetchJson } from './useMonths'

export function useReports(scope: Scope, monthKey: string | null, person: PersonFilter) {
  const [data, setData] = useState<ReportsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (scope === 'month' && !monthKey) return
    let cancelled = false

    async function run() {
      setLoading(true)
      const params = new URLSearchParams({ scope, person })
      if (scope === 'month' && monthKey) params.set('month', monthKey)
      try {
        const result = await fetchJson<ReportsResponse>(`/api/ica-tracking/reports?${params}`)
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()

    return () => {
      cancelled = true
    }
  }, [scope, monthKey, person])

  return { data, loading, error }
}
