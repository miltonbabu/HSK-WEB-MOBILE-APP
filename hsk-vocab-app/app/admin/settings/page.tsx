'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/admin/AdminSettings'), { ssr: false })
export default Page
