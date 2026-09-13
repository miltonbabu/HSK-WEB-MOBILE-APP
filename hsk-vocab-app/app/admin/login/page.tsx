'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/admin/AdminLogin'), { ssr: false })
export default Page
