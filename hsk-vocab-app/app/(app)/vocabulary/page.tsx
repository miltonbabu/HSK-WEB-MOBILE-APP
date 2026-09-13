'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Vocabulary'), { ssr: false })
export default Page
