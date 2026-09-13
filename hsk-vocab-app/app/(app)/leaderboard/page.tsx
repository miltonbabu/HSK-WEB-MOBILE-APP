'use client'

import dynamic from 'next/dynamic'
const Page = dynamic(() => import('@/views/Leaderboard'), { ssr: false })
export default Page
