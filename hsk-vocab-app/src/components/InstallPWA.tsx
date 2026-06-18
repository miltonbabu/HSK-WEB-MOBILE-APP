import { Download, X, Smartphone } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'

/**
 * Floating install card. Renders only when the browser has fired
 * `beforeinstallprompt` and the user hasn't recently dismissed it
 * and the app isn't already installed. Clicking "Install" re-uses
 * the same native dialog the user saw originally.
 */
export default function InstallPWA() {
  const { canInstall, installed, recentlyDismissed, promptInstall } = usePwaInstall()

  if (installed) return null
  if (!canInstall) return null
  if (recentlyDismissed) return null

  const install = async () => {
    await promptInstall()
  }

  return (
    <div
      role="dialog"
      aria-label="Install XueTong app"
      className="fixed top-4 right-4 z-[60] max-w-sm rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur shadow-xl p-4 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
          >
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Install XueTong
          </p>
        </div>
        <button
          onClick={install}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Not now"
          title="Not now"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Add to your home screen for one-tap offline access. Your progress will sync
        automatically when you reconnect.
      </p>
      <div className="flex gap-2 mt-1">
        <button
          onClick={install}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
        >
          <Download className="w-3.5 h-3.5" /> Install
        </button>
      </div>
    </div>
  )
}
