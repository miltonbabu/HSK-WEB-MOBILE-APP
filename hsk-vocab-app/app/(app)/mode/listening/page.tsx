'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/ListeningMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="listening" modeName="Listening Practice">
      <Mode />
    </RateLimitGuard>
  )
}
