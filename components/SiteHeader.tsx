'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { flushSync } from 'react-dom'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useReducedMotion } from 'motion/react'
import { buttonVariants } from '@/components/ui/button'

// First match wins. `project` is the data-project key (the pop colour).
const PROJECTS = [
  { path: '/bluebaycup/admin', project: 'home', name: 'Blue Bay Cup admin' },
  { path: '/bluebaycup', project: 'bbc', name: 'Blue Bay Cup' },
  { path: '/fpl-pred', project: 'fpl', name: 'FPL Predictions' },
  { path: '/playpilot', project: 'playpilot', name: 'PlayPilot' },
  { path: '/ica-tracking', project: 'food', name: 'Food Expenses' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const current = PROJECTS.find(p => pathname === p.path || pathname.startsWith(p.path + '/'))
  const { resolvedTheme, setTheme } = useTheme()
  const reduced = useReducedMotion()

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    if (reduced || !document.startViewTransition) return setTheme(next)
    document.startViewTransition(() => flushSync(() => setTheme(next)))
  }

  return (
    // The header sits outside the project layouts, so it sets its own pop for the dot.
    <header
      data-project={current?.project ?? 'home'}
      className="sticky top-0 z-20 flex h-16 items-center border-b border-line bg-[color-mix(in_srgb,var(--page)_86%,transparent)] backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-[clamp(16px,5vw,40px)]">
        <Link href="/" className="font-display text-base font-semibold tracking-[-0.01em] text-ink">
          wigh.nu
        </Link>
        {current && (
          <>
            <span aria-hidden className="text-lg text-line-strong">/</span>
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
              <span className="size-2 shrink-0 rounded-full bg-accent" />
              <span className="truncate">{current.name}</span>
            </span>
          </>
        )}
        <div className="flex-1" />
        <Link href="/#projects" className="rounded-full px-3 py-2 text-sm whitespace-nowrap text-ink-2 transition-colors hover:bg-surface-2">
          Projects
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
        >
          {/* Swapped in CSS, not from resolvedTheme, so server and client render the same markup. */}
          <Sun strokeWidth={1.75} className="hidden dark:block" />
          <Moon strokeWidth={1.75} className="dark:hidden" />
        </button>
      </div>
    </header>
  )
}
