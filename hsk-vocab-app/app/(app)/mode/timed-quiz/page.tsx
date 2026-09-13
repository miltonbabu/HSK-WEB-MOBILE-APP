'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/TimedQuizMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="timed-quiz" modeName="Timed Quiz">
      <Mode />
    </RateLimitGuard>
  )
}
