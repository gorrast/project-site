'use client'

import { usePathname } from 'next/navigation'
import { HomeButton } from '@/components/HomeButton'
import { ThemeToggle } from '@/components/ThemeToggle'

export function GlobalNavIcons() {
  const pathname = usePathname()

  // /bluebaycup has its own in-page header with a home button and theme
  // toggle — showing the global fixed ones too would duplicate both.
  // Exact match only, so /bluebaycup/admin (no in-page header) keeps them.
  if (pathname === '/bluebaycup') return null

  return (
    <div className="fixed top-4 right-4 z-9999 flex gap-2">
      <HomeButton />
      <ThemeToggle />
    </div>
  )
}
