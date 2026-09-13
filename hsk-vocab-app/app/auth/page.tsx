'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Auth'), { ssr: false })
export default Page
