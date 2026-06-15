import { useEffect, useState } from 'react'
import { Cpu, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { subscribeLocalLLM, loadLocalLLM, unloadLocalLLM, LocalLLMProgress, LOCAL_LLM_MODEL_ID } from '@/services/llm'
import { useSettingsStore } from '@/stores'

const DISMISSED_KEY = 'hsk-llm-prompt-dismissed'

/**
 * Floating chip that shows local-LLM download progress while the model
 * is loading, and offers a "Use on-device AI" prompt when it's ready.
 * Hides itself when the user dismisses or has fully opted in.
 */
export default function LocalLLMStatus() {
  const [progress, setProgress] = useState<LocalLLMProgress>({ status: 'idle', progress: 0, text: '' })
  const [dismissed, setDismissed] = useState(false)
  const [showReadyPrompt, setShowReadyPrompt] = useState(false)
  const llmMode = useSettingsStore((s) => s.llmMode)
  const setLlmMode = useSettingsStore((s) => s.setLlmMode)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') setDismissed(true)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => subscribeLocalLLM(setProgress), [])

  // Once the model transitions to ready, surface a one-time prompt so
  // the user can opt in (auto-mode users can ignore it).
  useEffect(() => {
    if (progress.status === 'ready' && !dismissed && !showReadyPrompt) {
      setShowReadyPrompt(true)
    }
  }, [progress.status, dismissed, showReadyPrompt])

  if (dismissed) return null

  // Loading state — always show so the user knows the download is happening.
  if (progress.status === 'loading') {
    return (
      <div className="fixed bottom-20 right-4 z-[55] w-72 rounded-2xl border border-teal-200 dark:border-teal-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur shadow-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <Loader2 className="w-5 h-5 text-teal-500 animate-spin mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Downloading on-device AI</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {progress.text || 'Preparing model…'}
            </p>
            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all duration-300"
                style={{ width: `${Math.round((progress.progress || 0) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {Math.round((progress.progress || 0) * 100)}% · cached after this
            </p>
          </div>
          <button
            onClick={() => { void unloadLocalLLM(); setDismissed(true) }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
            aria-label="Cancel download"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Error state — let the user retry.
  if (progress.status === 'error') {
    return (
      <div className="fixed bottom-20 right-4 z-[55] w-72 rounded-2xl border border-red-200 dark:border-red-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur shadow-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Couldn't load on-device AI</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {progress.error || 'Unknown error'}
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => void loadLocalLLM()}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-teal-500 text-white hover:bg-teal-600"
              >
                Retry
              </button>
              <button
                onClick={() => { try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}; setDismissed(true) }}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Use server instead
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Ready state — one-time prompt to opt in (only for users in auto mode).
  if (showReadyPrompt && llmMode === 'auto') {
    return (
      <div className="fixed bottom-20 right-4 z-[55] w-72 rounded-2xl border border-teal-200 dark:border-teal-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur shadow-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">On-device AI ready</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Run {LOCAL_LLM_MODEL_ID.split('-q')[0]} in your browser. Works offline, no server cost.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setLlmMode('local'); setShowReadyPrompt(false); try { localStorage.setItem(DISMISSED_KEY, '1') } catch {} }}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-teal-500 text-white hover:bg-teal-600 flex items-center gap-1"
              >
                <Cpu className="w-3 h-3" /> Use on-device
              </button>
              <button
                onClick={() => { setShowReadyPrompt(false); try { localStorage.setItem(DISMISSED_KEY, '1') } catch {} }}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Idle and unsupported — show nothing in the bottom-right. Users opt in
  // from the Settings page, which has the full control surface.
  if (progress.status === 'unsupported') return null
  if (llmMode === 'local' && progress.status === 'ready') return null

  return null
}
