'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { buttonVariants } from '@/components/ui/button'
import { RevealHeading, RevealSection, calmTransition } from '@/components/ui/Motion'
import { AuthGate } from './AuthGate'
import { MonthStepper } from './MonthStepper'
import { TabBar } from './TabBar'
import { BucketCards } from './BucketCards'
import { FairShareBudgetBar } from './FairShareBudgetBar'
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
  const reduced = useReducedMotion()
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
    <div className="mx-auto max-w-[1200px] px-[clamp(16px,5vw,40px)] pb-[120px]">
      <section className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5 pt-[clamp(40px,8vw,72px)] pb-7">
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">ICA · Hugo &amp; Benjamin</div>
          <RevealHeading as="h1" className="text-[clamp(40px,9vw,60px)] leading-none font-semibold tracking-[-0.035em]">
            Food expenses
          </RevealHeading>
        </div>
        {/* Project navigation lives in the hero, never in the shell. */}
        {showMonthNav && months.data && monthKey && (
          <div className="flex flex-wrap items-center gap-2">
            <MonthStepper months={months.data.months} currentKey={monthKey} onChange={handleMonthChange} />
            <a href={`/api/ica-tracking/month/${monthKey}/csv`} className={buttonVariants()}>
              Export CSV
            </a>
          </div>
        )}
      </section>

      <TabBar tab={tab} onChange={handleTabChange} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ ...calmTransition, duration: reduced ? 0 : 0.5 }}
        >
          {tab === 'month' && (
            <div className="flex flex-col gap-20">
              {monthData.data && (
                <section className="flex flex-col gap-3">
                  <BucketCards tally={monthData.data.tally} />
                  <FairShareBudgetBar tally={monthData.data.tally} />
                </section>
              )}
              <RevealSection>
                <ReportsSection scope={scope} onScopeChange={s => setParams({ scope: s })} monthKey={monthKey} />
              </RevealSection>
            </div>
          )}

          {tab === 'trends' && (
            <div className="flex flex-col gap-20">
              {trends.data && <MonthChart months={trends.data.months} activeKey={monthKey} onMonthClick={handleMonthChartClick} />}
              <RevealSection>
                <ProductOverTime />
              </RevealSection>
              <RevealSection>
                <ReportsSection scope={scope} onScopeChange={s => setParams({ scope: s })} monthKey={monthKey} />
              </RevealSection>
            </div>
          )}

          {tab === 'receipts' && (
            <div className="flex flex-col gap-4">
              <KeyboardHints />
              {monthData.saveError && <p role="alert" className="text-[13px] text-neg">{monthData.saveError}</p>}
              {/* Both panes scroll on their own on wide screens so the open receipt stays beside the list. */}
              <div className="flex flex-wrap items-start gap-4 lg:h-[calc(100dvh-140px)] lg:min-h-[480px] lg:items-stretch">
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
        </motion.div>
      </AnimatePresence>
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
