'use client'

import { useState, type ReactNode } from 'react'
import { RevealHeading } from '@/components/ui/Motion'

/** Section h2 plus the caption that says what the figures cover. `children` sit on the right. */
export function SectionHeading({ title, caption, children }: { title: string; caption?: ReactNode; children?: ReactNode }) {
  // RevealHeading lets GSAP re-parent the text while it animates, so a changed
  // title needs a fresh element; only the first title plays the reveal.
  const [firstTitle] = useState(title)
  const [changed, setChanged] = useState(false)
  if (!changed && title !== firstTitle) setChanged(true)

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <RevealHeading key={title} paused={changed} className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">
          {title}
        </RevealHeading>
        {caption && <p className="max-w-[640px] text-sm text-ink-3">{caption}</p>}
      </div>
      {children}
    </div>
  )
}
