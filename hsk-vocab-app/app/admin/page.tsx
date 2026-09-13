'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/admin/AdminDashboard'), { ssr: false })
export default Page
