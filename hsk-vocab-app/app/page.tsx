'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Landing'), { ssr: false })
export default Page
