'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Me'), { ssr: false })
export default Page
