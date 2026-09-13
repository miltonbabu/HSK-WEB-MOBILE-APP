'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/ReadingMode'), { ssr: false })
export default Page