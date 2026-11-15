'use client'

import React from 'react'

interface SectionSkeletonProps {
  heightClassName?: string
}

// Static on purpose: nothing on the site loops (DESIGN.md › Motion).
export default function SectionSkeleton({ heightClassName = 'h-64' }: SectionSkeletonProps) {
  return <div aria-hidden className={`w-full ${heightClassName} rounded-2xl border border-line bg-surface`} />
}
