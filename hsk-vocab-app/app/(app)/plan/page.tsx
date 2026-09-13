'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Plan'), { ssr: false })
export default Page
