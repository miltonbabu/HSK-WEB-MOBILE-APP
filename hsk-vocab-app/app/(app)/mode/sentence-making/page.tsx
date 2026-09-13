'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/SentenceMakingMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="sentence-making" modeName="Sentence Making">
      <Mode />
    </RateLimitGuard>
  )
}
