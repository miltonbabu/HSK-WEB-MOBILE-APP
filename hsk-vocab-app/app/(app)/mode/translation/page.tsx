'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/TranslationMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="translation" modeName="Translation">
      <Mode />
    </RateLimitGuard>
  )
}
