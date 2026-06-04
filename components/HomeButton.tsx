'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { House } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export function HomeButton() {
  const pathname = usePathname()

  if (pathname === '/') return null

  return (
    <Link
      href="/"
      aria-label="Go to homepage"
      className={buttonVariants({ variant: 'outline', size: 'icon', className: 'rounded-full shadow-md' })}
    >
      <House className="h-4 w-4" />
    </Link>
  )
}
