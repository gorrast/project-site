import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FPL points predictions',
}

export default function FplPredLayout({ children }: { children: React.ReactNode }) {
  return <div data-project="fpl">{children}</div>
}
