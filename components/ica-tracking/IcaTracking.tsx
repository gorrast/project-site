'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AuthGate } from './AuthGate'
import { MonthStepper } from './MonthStepper'
import { TabBar } from './TabBar'
import { BucketCards } from './BucketCards'
import { BudgetBar } from './BudgetBar'
import { ReportsSection } from './ReportsSection'
import { MonthChart } from './MonthChart'
import { ProductOverTime } from './ProductOverTime'
import { ReceiptList } from './ReceiptList'
import { ReceiptDetail } from './ReceiptDetail'
import { KeyboardHints } from './KeyboardHints'
import { ProductsTable } from './ProductsTable'
import { useMonths } from './hooks/useMonths'
import { useMonthData } from './hooks/useMonthData'
import { useTrends } from './hooks/useTrends'
import { useReceiptsKeyboard } from './hooks/useReceiptsKeyboard'
import type { Scope, Tab } from './types'

function IcaTrackingInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const months = useMonths()
  const tab = (searchParams.get('tab') as Tab | null) ?? 'month'
  const urlMonth = searchParams.get('month')
  const scope = (searchParams.get('scope') as Scope | null) ?? (tab === 'trends' ? 'all' : 'month')
  const monthKey = urlMonth ?? months.data?.currentMonthKey ?? null

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)

  const monthData = useMonthData(monthKey)
  const trends = useTrends()

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  const handleMonthChange = useCallback((key: string) => {
    setSelectedReceiptId(null)
    setCursor(0)
    setParams({ month: key })
  }, [setParams])

  const handleTabChange = useCallback((next: Tab) => {
    const patch: Record<string, string | null> = { tab: next }
    if (next === 'trends') patch.scope = 'all'
    if (next === 'month') patch.scope = 'month'
    setParams(patch)
  }, [setParams])

  const handleMonthChartClick = useCallback((key: string) => {
    setSelectedReceiptId(null)
    setCursor(0)
    setParams({ month: key, tab: 'month', scope: 'month' })
  }, [setParams])

  // Default the URL's month param once months load, so the view is linkable.
  useEffect(() => {
    if (!urlMonth && months.data?.currentMonthKey) {
      setParams({ month: months.data.currentMonthKey })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMonth, months.data?.currentMonthKey])

  const receipts = monthData.data?.receipts ?? []
  const effectiveSelectedId =
    selectedReceiptId && receipts.some(r => r.id === selectedReceiptId) ? selectedReceiptId : receipts[0]?.id ?? null
  const selectedReceipt = receipts.find(r => r.id === effectiveSelectedId) ?? null

  const selectReceipt = useCallback((id: string) => {
    setSelectedReceiptId(id)
    setCursor(0)
  }, [])

  useReceiptsKeyboard({
    active: tab === 'receipts',
    receipts,
    selectedReceiptId: effectiveSelectedId,
    cursor,
    setCursor: updater => setCursor(updater),
    selectReceipt,
    setLineConsumer: (lineId, consumer) => monthData.setLineConsumer(lineId, consumer),
    setReceiptExcluded: (receiptId, excluded) => monthData.setReceiptExcluded(receiptId, excluded),
  })

  const showMonthNav = tab === 'month' || tab === 'receipts'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-[1180px] mx-auto px-[18px] pb-[90px] pt-[26px] flex flex-col gap-[18px]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
              ICA · HUGO &amp; BENJAMIN
            </div>
            <h1 className="font-heading text-[34px] font-bold tracking-[-0.02em] leading-[1.05] text-gray-900 dark:text-gray-100">
              Food expenses
            </h1>
          </div>
          {showMonthNav && months.data && monthKey && (
            <div className="flex items-center gap-2">
              <MonthStepper months={months.data.months} currentKey={monthKey} onChange={handleMonthChange} />
              <a href={`/api/ica-tracking/month/${monthKey}/csv`}>
                <Button variant="outline">Export CSV</Button>
              </a>
            </div>
          )}
        </div>

        <TabBar tab={tab} onChange={handleTabChange} />

        {tab === 'month' && (
          <div className="flex flex-col gap-[18px]">
            {monthData.data && (
              <>
                <BucketCards tally={monthData.data.tally} />
                <BudgetBar total={monthData.data.tally.total} />
              </>
            )}
            <ReportsSection scope={scope} onScopeChange={s => setParams({ scope: s })} monthKey={monthKey} />
          </div>
        )}

        {tab === 'trends' && (
          <div className="flex flex-col gap-[18px]">
            {trends.data && <MonthChart months={trends.data.months} onMonthClick={handleMonthChartClick} />}
            <ProductOverTime />
            <ReportsSection scope={scope} onScopeChange={s => setParams({ scope: s })} monthKey={monthKey} />
          </div>
        )}

        {tab === 'receipts' && (
          <div className="flex flex-col gap-3">
            <KeyboardHints />
            {monthData.saveError && <p className="text-sm text-red-600">{monthData.saveError}</p>}
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
              <ReceiptList
                receipts={receipts}
                selectedId={effectiveSelectedId}
                onSelect={selectReceipt}
                monthLabel={monthData.data?.label ?? ''}
              />
              {selectedReceipt && (
                <ReceiptDetail
                  receipt={selectedReceipt}
                  cursor={cursor}
                  onCursorChange={setCursor}
                  onSetLineConsumer={(lineId, consumer) => monthData.setLineConsumer(lineId, consumer)}
                  onToggleExcluded={() => monthData.setReceiptExcluded(selectedReceipt.id, !selectedReceipt.excluded)}
                />
              )}
            </div>
          </div>
        )}

        {tab === 'products' && <ProductsTable />}
      </div>
    </div>
  )
}

export default function IcaTracking() {
  return (
    <AuthGate>
      <IcaTrackingInner />
    </AuthGate>
  )
}
