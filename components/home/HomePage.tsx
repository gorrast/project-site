'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { MetricGroup, RevealHeading, RevealSection, quietItemProps } from '@/components/ui/Motion'
import { SectionHeading } from '@/components/SectionHeading'

const projects = [
  {
    id: 'bbc',
    title: 'Blue Bay Cup',
    kind: 'Statistics',
    href: '/bluebaycup',
    image: '/bluebaycup_project.png',
    description:
      'Tracker for our Fantasy Draft Premier League. Season development, all-time standings and head-to-head records, from the FPL API and stored in Supabase.',
    tags: 'Fantasy football · Statistics',
    status: 'Live · updates every gameweek',
    cta: 'View standings',
  },
  {
    id: 'fpl',
    title: 'FPL Predictions',
    kind: 'Machine learning',
    href: '/fpl-pred',
    image: '/fpl-pred.png',
    description:
      'Predicted points for every player in a Draft league, from historical data, current form and live odds, with the starting XI that scores the most.',
    tags: 'Machine learning · Fantasy football',
    status: 'Model retrained weekly',
    cta: 'See this week',
  },
  {
    id: 'playpilot',
    title: 'PlayPilot Compare',
    kind: 'Prototype',
    href: '/playpilot',
    image: '/playpilot_raw.png',
    description: 'Pulls the ratings from PlayPilot profiles and compares them side by side, across films and series.',
    tags: 'Selenium · Statistics · Film & TV',
    status: 'Early prototype',
    cta: 'Open prototype',
  },
  {
    id: 'food',
    title: 'Food Expenses',
    kind: 'Household',
    href: '/ica-tracking',
    image: '/kivra-sync.png',
    description:
      'Grocery receipts pulled from Kivra and analyzed for monthly spending against budget.',
    tags: 'Household · Kivra',
    status: 'Private · two users',
    cta: 'Open tracker',
  },
]

const number = (i: number) => String(i + 1).padStart(2, '0')

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100dvh-64px)] flex-col">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-24 px-[clamp(16px,5vw,40px)] pb-[120px]">
        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-end gap-x-16 gap-y-12 pt-[clamp(48px,10vw,112px)]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Hugo Wigh · side projects</div>
            <RevealHeading as="h1" className="text-[clamp(44px,9vw,76px)] leading-[0.98] font-semibold tracking-[-0.04em]">
              Things I&apos;ve been building
            </RevealHeading>
            <p className="max-w-[560px] text-lg leading-[1.6] text-pretty text-ink-2">
              Fantasy football stats and a model that predicts points, a comparison tool for PlayPilot profiles, and a
              grocery tracker built on our Kivra receipts.
            </p>
          </div>
          <nav aria-label="Project index" className="flex flex-col border-t border-line">
            {projects.map((p, i) => (
              <Link
                key={p.id}
                href={p.href}
                data-project={p.id}
                className="grid min-h-[52px] grid-cols-[28px_12px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-2 text-ink transition-colors hover:bg-surface-2"
              >
                <span className="font-mono text-xs text-ink-3">{number(i)}</span>
                <span className="size-2.5 rounded-full bg-accent" />
                <span className="truncate text-[15px] font-medium">{p.title}</span>
                <span className="font-mono text-[11px] tracking-[0.06em] whitespace-nowrap text-ink-3 uppercase">{p.kind}</span>
              </Link>
            ))}
          </nav>
        </section>

        <RevealSection id="projects" className="scroll-mt-[88px]">
          <SectionHeading title="Projects" caption="Each project keeps the same shell and gets one colour of its own." />
          <MetricGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-4">
            {projects.map(p => (
              <motion.div key={p.id} {...quietItemProps} className="flex min-w-0">
                {/* The whole card is the link. No lift; the border and the arrow carry the hover. */}
                <Link
                  href={p.href}
                  data-project={p.id}
                  className="group flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink transition-colors duration-200 ease-(--ease-calm) hover:border-accent hover:bg-surface-2"
                >
                  <div className="relative aspect-[16/10] border-b border-line bg-surface-2">
                    <Image
                      src={p.image}
                      alt=""
                      fill
                      sizes="(max-width: 960px) 100vw, 600px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 px-6 py-[22px]">
                    <span className="flex items-center gap-2.5">
                      <span className="size-2.5 flex-none rounded-full bg-accent" />
                      <span className="font-display text-2xl leading-[1.15] font-semibold tracking-[-0.02em]">{p.title}</span>
                    </span>
                    <span className="text-sm leading-[1.6] text-pretty text-ink-2">{p.description}</span>
                    <span className="font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">{p.tags}</span>
                    <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2.5">
                      <span className="text-xs text-ink-3">{p.status}</span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap text-accent-text">
                        {p.cta}
                        <span
                          aria-hidden
                          className="transition-transform duration-[260ms] ease-(--ease-calm) group-hover:translate-x-1 motion-reduce:transform-none"
                        >
                          →
                        </span>
                      </span>
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </MetricGroup>
        </RevealSection>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-[clamp(16px,5vw,40px)] py-7">
          <span className="font-display text-[15px] font-semibold">Hugo Wigh</span>
          <a href="mailto:hugo@wigh.nu" className="text-sm text-accent-text hover:underline">
            hugo@wigh.nu
          </a>
        </div>
      </footer>
    </div>
  )
}
