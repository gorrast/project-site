'use client'

import { BUDGET_COLOR, CONSUMER_COLORS, kr, MONTHLY_BUDGET_KR } from './colors'
import type { Tally } from './types'

const HALF = MONTHLY_BUDGET_KR / 2

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

interface SideSegments {
  own: number // % of the full bar width
  shared: number
  fair: number // the raw kr amount (person + half of shared), for the text line
}

/** Splits one person's fair-share fill into two stacked segments as % of
 * the FULL bar width (so 50% lands exactly on the center / half-target
 * line): their own color, then their half of shared continuing from
 * there. Colors never change past the center — the dashed threshold line
 * drawn over the bar is the only "have I passed my fair share" signal, so
 * a fill simply keeps growing in its normal colors if it crosses it. */
function buildSide(personAmount: number, sharedAmount: number): SideSegments {
  const fair = personAmount + 0.5 * sharedAmount
  const fairPct = clamp((fair / MONTHLY_BUDGET_KR) * 100, 0, 100)
  const own = clamp((personAmount / MONTHLY_BUDGET_KR) * 100, 0, fairPct)
  const shared = fairPct - own
  return { own, shared, fair }
}

function statusText(fair: number): string {
  const over = fair > HALF
  return over ? `${kr(fair - HALF)} over fair share` : `${kr(HALF - fair)} left of fair share`
}

export function FairShareBudgetBar({ tally }: { tally: Tally }) {
  const hugo = buildSide(tally.Hugo, tally.shared)
  const ben = buildSide(tally.Benjamin, tally.shared)
  const householdOver = tally.total > MONTHLY_BUDGET_KR
  const householdNote = householdOver
    ? `${kr(tally.total - MONTHLY_BUDGET_KR)} over`
    : `${kr(MONTHLY_BUDGET_KR - tally.total)} left`

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-[18px] py-4 shadow-[0_1px_3px_rgba(17,24,39,0.06)]">
      <div className="flex items-center justify-between">
        <span className="font-heading text-sm font-medium text-gray-900 dark:text-gray-100">
          Monthly target {kr(MONTHLY_BUDGET_KR)}
        </span>
        <span className="font-mono text-[12.5px]" style={{ color: householdOver ? BUDGET_COLOR : undefined }}>
          {householdNote}
        </span>
      </div>

      {/* Outer wrapper is NOT overflow-hidden, so the threshold line below
          can extend taller than the bar itself and stay visible even once
          a fill has grown past it and would otherwise swallow it. */}
      <div className="relative mt-3 py-1">
        <div className="relative h-3.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
          {/* Hugo, growing rightward from the left edge: own, then half-shared */}
          <div className="absolute inset-y-0 left-0" style={{ width: `${hugo.own}%`, backgroundColor: CONSUMER_COLORS.Hugo }} />
          <div
            className="absolute inset-y-0"
            style={{ left: `${hugo.own}%`, width: `${hugo.shared}%`, backgroundColor: CONSUMER_COLORS.shared }}
          />

          {/* Benjamin, mirrored: growing leftward from the right edge */}
          <div className="absolute inset-y-0 right-0" style={{ width: `${ben.own}%`, backgroundColor: CONSUMER_COLORS.Benjamin }} />
          <div
            className="absolute inset-y-0"
            style={{ right: `${ben.own}%`, width: `${ben.shared}%`, backgroundColor: CONSUMER_COLORS.shared }}
          />
        </div>

        {/* Fair-share threshold — the center of the bar is exactly half the
            target. Sits outside the bar's own overflow-hidden box and
            extends a few px above/below it, so it stays visible against
            the card background regardless of what color is filled behind
            it inside the bar. */}
        <div
          className="absolute left-1/2 w-0 border-l-2 border-dashed"
          style={{ borderColor: BUDGET_COLOR, top: 0, bottom: 0 }}
        />
      </div>

      <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] text-gray-500 dark:text-gray-400">
        <span>Hugo {kr(hugo.fair)} — {statusText(hugo.fair)}</span>
        <span>Benjamin {kr(ben.fair)} — {statusText(ben.fair)}</span>
      </div>
    </div>
  )
}
