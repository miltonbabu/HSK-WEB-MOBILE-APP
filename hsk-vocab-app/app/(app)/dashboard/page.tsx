'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Dashboard'), { ssr: false })
export default Page
