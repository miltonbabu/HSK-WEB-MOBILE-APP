'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Policy'), { ssr: false })
export default Page
