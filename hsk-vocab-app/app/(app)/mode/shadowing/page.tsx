'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/ShadowingMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="shadowing" modeName="Shadowing">
      <Mode />
    </RateLimitGuard>
  )
}
