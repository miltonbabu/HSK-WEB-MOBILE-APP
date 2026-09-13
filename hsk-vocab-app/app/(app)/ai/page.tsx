'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/AIChat'), { ssr: false })
export default Page
