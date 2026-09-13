'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Settings'), { ssr: false })
export default Page
