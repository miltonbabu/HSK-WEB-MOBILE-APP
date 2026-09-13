'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Learn'), { ssr: false })
export default Page
