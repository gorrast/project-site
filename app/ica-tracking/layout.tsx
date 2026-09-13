import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Food expenses',
}

export default function IcaTrackingLayout({ children }: { children: React.ReactNode }) {
  return children
}
