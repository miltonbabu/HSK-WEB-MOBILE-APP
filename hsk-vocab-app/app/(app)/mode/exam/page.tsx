'use client'

import dynamic from 'next/dynamic'
import RateLimitGuard from '@/components/RateLimitGuard'
const Mode = dynamic(() => import('@/views/modes/ExamMode'), { ssr: false })
export default function Page() {
  return (
    <RateLimitGuard modeId="exam" modeName="HSK Mock Exam">
      <Mode />
    </RateLimitGuard>
  )
}
