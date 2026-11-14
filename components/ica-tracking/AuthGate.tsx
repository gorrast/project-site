'use client'

import { useEffect, useState } from 'react'
import { LoginCard } from '@/components/LoginCard'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ica-tracking/admin/check')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.authenticated) setIsAuthenticated(true)
      })
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center">
        <p className="text-sm text-ink-3">Loading…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <LoginCard
        eyebrow="ICA · Hugo & Benjamin"
        title="Food expenses"
        endpoint="/api/ica-tracking/admin/login"
        onLogin={() => setIsAuthenticated(true)}
      />
    )
  }

  return <>{children}</>
}
