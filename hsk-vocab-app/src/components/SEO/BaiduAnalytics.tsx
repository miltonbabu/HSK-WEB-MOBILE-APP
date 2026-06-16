import { useEffect } from 'react'

const BAIDU_TONGJI_ID = import.meta.env.VITE_BAIDU_TONGJI_ID as string | undefined

export default function BaiduAnalytics() {
  useEffect(() => {
    if (!BAIDU_TONGJI_ID) return
    if (document.getElementById('baidu-tongji')) return

    const script = document.createElement('script')
    script.id = 'baidu-tongji'
    script.src = `https://hm.baidu.com/hm.js?${BAIDU_TONGJI_ID}`
    script.async = true
    document.head.appendChild(script)

    window._hmt = window._hmt || []
  }, [])

  return null
}

declare global {
  interface Window {
    _hmt: any[]
  }
}
