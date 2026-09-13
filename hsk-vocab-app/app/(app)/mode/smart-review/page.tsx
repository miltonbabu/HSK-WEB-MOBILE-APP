'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/SmartReviewMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="smart-review" modeName="AI Smart Review">
      <Mode />
    </RateLimitGuard>
  )
}
