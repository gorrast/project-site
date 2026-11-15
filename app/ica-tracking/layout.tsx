import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kivra-sync!',
}

export default function IcaTrackingLayout({ children }: { children: React.ReactNode }) {
  return <div data-project="food">{children}</div>
}
