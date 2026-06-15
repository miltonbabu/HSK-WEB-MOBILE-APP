import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Floating chip that appears whenever the browser is offline.
 * Tells the user their progress is being saved locally and will
 * sync to Supabase when the network returns.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus()
  const [show, setShow] = useState(false)

  // Delay appearance slightly so the banner doesn't flash during
  // brief connectivity blips on page load.
  useEffect(() => {
    if (!online) {
      const t = setTimeout(() => setShow(true), 600)
      return () => clearTimeout(t)
    }
    setShow(false)
  }, [online])

  if (online || !show) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full bg-amber-500/95 text-white text-sm shadow-lg flex items-center gap-2 backdrop-blur">
      <WifiOff className="w-4 h-4" />
      <span>You're offline — progress saves locally and will sync when you reconnect.</span>
    </div>
  )
}
