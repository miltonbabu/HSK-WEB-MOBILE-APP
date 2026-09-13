'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/VisualMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="visual" modeName="Visual Learning">
      <Mode />
    </RateLimitGuard>
  )
}
