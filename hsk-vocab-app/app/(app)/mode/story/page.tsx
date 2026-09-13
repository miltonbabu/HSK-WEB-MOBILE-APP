'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/StoryMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="story" modeName="AI Story">
      <Mode />
    </RateLimitGuard>
  )
}
