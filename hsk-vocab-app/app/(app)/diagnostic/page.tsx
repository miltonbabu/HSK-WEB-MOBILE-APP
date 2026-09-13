'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/DiagnosticMode'), { ssr: false })
export default Page