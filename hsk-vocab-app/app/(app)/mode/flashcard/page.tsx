'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/FlashcardMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="flashcard" modeName="Flashcard SRS">
      <Mode />
    </RateLimitGuard>
  )
}
