'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/admin/AdminUsers'), { ssr: false })
export default Page
