'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/HandwritingMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="handwriting" modeName="Handwriting">
      <Mode />
    </RateLimitGuard>
  )
}
