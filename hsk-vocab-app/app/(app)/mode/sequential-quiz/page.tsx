'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/SequentialQuizMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="sequential-quiz" modeName="Sequential Quiz">
      <Mode />
    </RateLimitGuard>
  )
}
