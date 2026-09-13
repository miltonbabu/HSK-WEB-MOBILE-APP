'use client'

import { useEffect, Component, type ReactNode } from 'react'
import { useAuthStore, useSettingsStore } from '@/stores'
import OfflineBanner from '@/components/OfflineBanner'
import InstallPWA from '@/components/InstallPWA'
import LocalLLMStatus from '@/components/LocalLLMStatus'
import BaiduAnalytics from '@/components/SEO/BaiduAnalytics'
import { AlertCircle } from 'lucide-react'

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unknown error' }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[AppErrorBoundary] Uncaught error:', error, info)
  }

  handleReload = () => {
    try {
      window.location.reload()
    } catch {
      /* noop */
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)' }}
        >
          <AlertCircle className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-lg font-semibold text-ink-900 dark:text-white">
          Something went wrong loading the app
        </h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 max-w-md">
          A page chunk failed to load. This usually clears on a refresh.
        </p>
        {this.state.message ? (
          <p className="text-xs text-ink-400 dark:text-ink-500 max-w-md break-all">
            {this.state.message}
          </p>
        ) : null}
        <button
          onClick={this.handleReload}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
        >
          Reload
        </button>
      </div>
    )
  }
}

function SplashOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4"
      style={{
        background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 30%, #f0fdf4 60%, #fff7ed 100%)',
      }}
      aria-hidden="true"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          boxShadow: '0 8px 25px rgba(139,92,246,0.4)',
        }}
      >
        <img src="/icon-64.png" alt="XueTong" className="w-10 h-10 object-contain" />
      </div>
      <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-red-500/30 border-t-red-500" />
    </div>
  )
}

export default function Providers({ children }: { children: ReactNode }) {
  const { checkAuth, isLoading, user } = useAuthStore()
  const { darkMode } = useSettingsStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.documentElement.style.colorScheme = 'dark'
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    }
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement
    if (meta) {
      meta.content = darkMode ? '#0f0720' : '#faf5ff'
    }
  }, [darkMode])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    ;(async () => {
      try {
        const { initDatabase, query, exec, forceSaveDb } = await import('@/services/database')
        const { seedVocabulary, invalidateWordsCache } = await import('@/services/sqlite-api')

        await initDatabase()

        if (cancelled) return

        const wordCount = (() => {
          try {
            const result = query('SELECT COUNT(*) as count FROM words')
            return (result[0]?.count || 0) as number
          } catch {
            return 0
          }
        })()

        if (wordCount < 2000) {
          try {
            const response = await fetch('/hsk_vocabulary_complete.json')
            const vocabularyData = await response.json()

            const words = vocabularyData.words.map((word: any) => ({
              hsk_level: word.hsk_level,
              chinese: word.chinese,
              pinyin: word.pinyin,
              english: word.english || '',
              pos: Array.isArray(word.pos) ? JSON.stringify(word.pos) : word.pos,
              pos_raw: word.pos_raw || '',
              category: word.topic_category || '',
              example_sentences: Array.isArray(word.example_sentences) ? JSON.stringify(word.example_sentences) : '[]',
              radical: word.radical || '',
              stroke_count: word.stroke_count || 0,
            }))

            exec('DELETE FROM words')
            await seedVocabulary(words)
            invalidateWordsCache()
            console.log(`Seeded ${words.length} vocabulary words into SQLite`)
          } catch (error) {
            console.error('Failed to seed vocabulary data:', error)
          }
        } else {
          console.log(`Database has ${wordCount} words, skipping vocabulary seed.`)
        }

        if (cancelled) return

        const { wordService } = await import('@/services/sqlite-api')
        wordService.getAll()

        const { maybeAutoBackup } = await import('@/services/db-backup')
        maybeAutoBackup()

        const handleBeforeUnload = () => {
          try {
            forceSaveDb()
          } catch {
            /* noop */
          }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
      } catch (error) {
        console.error('App initialization failed:', error)
      }
    })()

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] service worker registered, scope:', reg.scope)
        })
        .catch((err) => {
          console.warn('SW registration failed:', err)
        })
    }

    return () => {
      cancelled = true
    }
  }, [])

  const showSplash = isLoading && !user

  return (
    <>
      <OfflineBanner />
      <InstallPWA />
      <LocalLLMStatus />
      <AppErrorBoundary>{children}</AppErrorBoundary>
      {showSplash && <SplashOverlay />}
      <BaiduAnalytics />
    </>
  )
}
