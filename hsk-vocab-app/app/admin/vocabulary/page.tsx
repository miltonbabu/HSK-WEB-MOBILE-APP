'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/admin/AdminVocabulary'), { ssr: false })
export default Page
