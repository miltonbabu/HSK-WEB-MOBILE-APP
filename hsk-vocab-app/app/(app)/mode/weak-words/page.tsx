'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/modes/WeakWordsMode'), { ssr: false })
export default Page
