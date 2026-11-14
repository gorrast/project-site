'use client'

import { CONSUMER_COLORS, kr, MONTHLY_BUDGET_KR } from './colors'
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

function Side({ name, color, fair }: { name: string; color: string; fair: number }) {
  const over = fair > HALF
  return (
    <span>
      <span style={{ color }}>{name}</span> {kr(fair, false)} kr ·{' '}
      <span className={over ? 'text-neg' : 'text-ink-2'}>
        {over ? `${kr(fair - HALF)} over fair share` : `${kr(HALF - fair)} left of fair share`}
      </span>
    </span>
  )
}

export function FairShareBudgetBar({ tally }: { tally: Tally }) {
  const hugo = buildSide(tally.Hugo, tally.shared)
  const ben = buildSide(tally.Benjamin, tally.shared)
  const householdOver = tally.total > MONTHLY_BUDGET_KR

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-[22px] py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-display text-lg font-semibold tracking-[-0.01em]">
          Fair share of a {MONTHLY_BUDGET_KR.toLocaleString('sv-SE')} kr month
        </span>
        <span className={householdOver ? 'font-mono text-[13px] text-neg' : 'font-mono text-[13px] text-ink'}>
          {householdOver ? `${kr(tally.total - MONTHLY_BUDGET_KR)} over` : `${kr(MONTHLY_BUDGET_KR - tally.total)} left`}
        </span>
      </div>

      {/* Outer wrapper is NOT overflow-hidden, so the threshold line can
          extend past the bar and stay visible once a fill has crossed it. */}
      <div className="relative py-[5px]">
        <div
          role="img"
          aria-label={`Hugo ${kr(hugo.fair)}, Benjamin ${kr(ben.fair)}, against ${kr(HALF)} each`}
          className="relative h-3.5 overflow-hidden rounded-[7px] bg-surface-3"
        >
          {/* Hugo grows rightward from the left edge: own, then half of shared */}
          <span className="absolute inset-y-0 left-0" style={{ width: `${hugo.own}%`, backgroundColor: CONSUMER_COLORS.Hugo }} />
          <span className="absolute inset-y-0" style={{ left: `${hugo.own}%`, width: `${hugo.shared}%`, backgroundColor: CONSUMER_COLORS.shared }} />
          {/* Benjamin mirrors it from the right edge */}
          <span className="absolute inset-y-0 right-0" style={{ width: `${ben.own}%`, backgroundColor: CONSUMER_COLORS.Benjamin }} />
          <span className="absolute inset-y-0" style={{ right: `${ben.own}%`, width: `${ben.shared}%`, backgroundColor: CONSUMER_COLORS.shared }} />
        </div>
        {/* The centre of the bar is exactly half the target. */}
        <span aria-hidden="true" className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-neg" />
      </div>

      <div className="flex flex-wrap justify-between gap-4 font-mono text-xs">
        <Side name="Hugo" color={CONSUMER_COLORS.Hugo} fair={hugo.fair} />
        <Side name="Benjamin" color={CONSUMER_COLORS.Benjamin} fair={ben.fair} />
      </div>
      <span className="text-xs text-ink-3">
        Each side fills with that person&apos;s own food, then half of the shared food. The dashed line is half the target.
      </span>
    </div>
  )
}
