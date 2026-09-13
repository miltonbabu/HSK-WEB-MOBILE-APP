'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/ConversationMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="conversation" modeName="AI Conversation">
      <Mode />
    </RateLimitGuard>
  )
}
