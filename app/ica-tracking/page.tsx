import { Suspense } from 'react'
import IcaTracking from '@/components/ica-tracking/IcaTracking'

export default function IcaTrackingPage() {
  return (
    <Suspense fallback={null}>
      <IcaTracking />
    </Suspense>
  )
}
