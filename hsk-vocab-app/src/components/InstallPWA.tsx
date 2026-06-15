import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'hsk-pwa-install-dismissed-at'
const DISMISS_DAYS = 7

/**
 * Listens for the browser's `beforeinstallprompt` event and shows a
 * small floating card letting the user install XueTong as a PWA.
 * The user can dismiss the prompt — we then keep it hidden for
 * `DISMISS_DAYS` days to avoid nagging.
 */
export default function InstallPWA() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const dismissedAt = (() => {
      try {
        const v = localStorage.getItem(DISMISSED_KEY)
        if (!v) return 0
        return Number(v) || 0
      } catch { return 0 }
    })()
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  if (installed) return null
  if (!evt) return null

  const install = async () => {
    if (!evt) return
    await evt.prompt()
    const { outcome } = await evt.userChoice
    if (outcome === 'dismissed') {
      try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* ignore */ }
    }
    setEvt(null)
  }

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* ignore */ }
    setEvt(null)
  }

  return (
    <div className="fixed top-4 right-4 z-[60] max-w-sm rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Install XueTong</p>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Add to your home screen for one-tap offline access. Your progress will sync automatically when you reconnect.
      </p>
      <div className="flex gap-2 mt-1">
        <button
          onClick={install}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-500 text-white hover:bg-teal-600 flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Install
        </button>
        <button
          onClick={dismiss}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
