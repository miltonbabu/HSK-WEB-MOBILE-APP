import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALLED_KEY = 'hsk-pwa-installed'
const DISMISSED_KEY = 'hsk-pwa-install-dismissed-at'
const DISMISS_HOURS = 6

/**
 * Hook that exposes the browser's deferred `beforeinstallprompt` event
 * so any component on the page can trigger the install popup on demand.
 *
 * Why this exists: once the user dismisses the auto-popup, the browser
 * will NOT re-fire `beforeinstallprompt` until the next session. But
 * the saved event is still in memory for the rest of the current
 * session, so we cache it here and let the user click "Install" again.
 */
export function usePwaInstall() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => {
    try {
      if (localStorage.getItem(INSTALLED_KEY) === '1') return true
    } catch { /* ignore */ }
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    )
  })

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => {
      setInstalled(true)
      try { localStorage.setItem(INSTALLED_KEY, '1') } catch { /* ignore */ }
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // Returns true if user dismissed within the cooldown window.
  const recentlyDismissed = (() => {
    try {
      const v = localStorage.getItem(DISMISSED_KEY)
      if (!v) return false
      const t = Number(v) || 0
      return Date.now() - t < DISMISS_HOURS * 60 * 60 * 1000
    } catch { return false }
  })()

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!evt) return 'unavailable'
    try {
      await evt.prompt()
      const { outcome } = await evt.userChoice
      if (outcome === 'dismissed') {
        try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* ignore */ }
      } else {
        setInstalled(true)
        try { localStorage.setItem(INSTALLED_KEY, '1') } catch { /* ignore */ }
      }
      return outcome
    } catch {
      return 'unavailable'
    } finally {
      setEvt(null)
    }
  }

  const resetDismiss = () => {
    try { localStorage.removeItem(DISMISSED_KEY) } catch { /* ignore */ }
  }

  return {
    /** True once the app is installed (standalone / PWA mode). */
    installed,
    /** The saved beforeinstallprompt event, or null if browser hasn't fired one. */
    canInstall: !!evt && !installed,
    /** Triggers the native install popup. */
    promptInstall,
    /** True if user dismissed the auto-popup within the cooldown window. */
    recentlyDismissed,
    /** Clear the dismiss cooldown so the next render shows the prompt again. */
    resetDismiss,
  }
}
