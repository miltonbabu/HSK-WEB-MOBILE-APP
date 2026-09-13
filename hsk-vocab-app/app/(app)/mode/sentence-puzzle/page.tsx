'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/SentencePuzzleMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="sentence-puzzle" modeName="Sentence Puzzle">
      <Mode />
    </RateLimitGuard>
  )
}
