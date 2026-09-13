import { useCallback, useEffect, useState } from 'react'
import type { Consumer, MonthData } from '../types'
import { withLineConsumer, withReceiptExcluded } from '../resolution'
import { fetchJson } from './useMonths'

export function useMonthData(monthKey: string | null) {
  const [data, setData] = useState<MonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!monthKey) return
    setLoading(true)
    try {
      const result = await fetchJson<MonthData>(`/api/ica-tracking/month/${monthKey}`)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [monthKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  const setLineConsumer = useCallback(async (lineId: number, consumer: Consumer) => {
    setSaveError(null)
    setData(prev => (prev ? withLineConsumer(prev, lineId, consumer) : prev))
    try {
      const res = await fetch(`/api/ica-tracking/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumer }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setSaveError('Failed to save — reverted')
      refetch()
    }
  }, [refetch])

  const setReceiptExcluded = useCallback(async (receiptId: string, excluded: boolean) => {
    setSaveError(null)
    setData(prev => (prev ? withReceiptExcluded(prev, receiptId, excluded) : prev))
    try {
      const res = await fetch(`/api/ica-tracking/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setSaveError('Failed to save — reverted')
      refetch()
    }
  }, [refetch])

  return { data, loading, error, saveError, refetch, setLineConsumer, setReceiptExcluded }
}
