import { useEffect, useRef, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const AUTO_DISMISS_MS = 4000
const SHOW_DELAY_MS = 600

/**
 * Toast that flashes briefly when the user transitions between
 * online and offline. Does NOT appear on initial page load — only
 * on real connectivity changes during the session.
 *
 * "You're offline"  → shows for ~4s then auto-dismisses
 * "Back online"     → shows for ~4s then auto-dismisses
 */
export default function OfflineBanner() {
  const online = useOnlineStatus()
  const [visible, setVisible] = useState(false)
  // Tracks if we've ever seen the user come online, so the banner
  // does not fire on a cold start (e.g. when the PWA boots offline).
  const hasBeenOnline = useRef(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  // Snapshot of the last network state so we can detect transitions.
  const prevOnline = useRef(online)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const wasOnline = prevOnline.current
    prevOnline.current = online

    if (wasOnline === online) return // no transition

    // We only react to a real transition *after* the user has been
    // online at least once during this session. PWA cold start with
    // no network → no banner.
    if (online) {
      hasBeenOnline.current = true
    }
    if (!hasBeenOnline.current) return

    // Clear pending timers from a previous flip.
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }

    // Small delay so the banner doesn't flash during a transient blip.
    showTimer.current = setTimeout(() => {
      setVisible(true)
      dismissTimer.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    }, SHOW_DELAY_MS)

    return () => {
      if (showTimer.current) {
        clearTimeout(showTimer.current)
        showTimer.current = null
      }
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current)
        dismissTimer.current = null
      }
    }
  }, [online])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full text-white text-sm shadow-lg flex items-center gap-2 backdrop-blur ${
        online ? 'bg-emerald-500/95' : 'bg-amber-500/95'
      }`}
    >
      {online ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Back online — progress will sync now.</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>You're offline — progress saves locally and will sync when you reconnect.</span>
        </>
      )}
    </div>
  )
}
