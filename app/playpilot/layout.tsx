import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Playpilot Compare',
}

export default function PlayPilotLayout({ children }: { children: React.ReactNode }) {
  return <div data-project="playpilot">{children}</div>
}
