'use client'

import React from 'react'

interface SectionSkeletonProps {
  heightClassName?: string
}

export default function SectionSkeleton({ heightClassName = 'h-64' }: SectionSkeletonProps) {
  return <div className={`w-full ${heightClassName} rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse`} />
}
