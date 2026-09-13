'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Mistakes'), { ssr: false })
export default Page