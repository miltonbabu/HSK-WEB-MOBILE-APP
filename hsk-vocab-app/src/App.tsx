import { Suspense, lazy, useEffect, Component, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, useSettingsStore } from '@/stores'
import Layout from '@/components/Layout'
import OfflineBanner from '@/components/OfflineBanner'
import InstallPWA from '@/components/InstallPWA'
import LocalLLMStatus from '@/components/LocalLLMStatus'
import BaiduAnalytics from '@/components/SEO/BaiduAnalytics'
import RateLimitGuard from '@/components/RateLimitGuard'
import { Loader2, AlertCircle } from 'lucide-react'

// Eager-loaded (small, needed early)
const Landing = lazy(() => import('@/pages/Landing'))
const Auth = lazy(() => import('@/pages/Auth'))
const Policy = lazy(() => import('@/pages/Policy'))

// User pages — lazy chunks
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Learn = lazy(() => import('@/pages/Learn'))
const Vocabulary = lazy(() => import('@/pages/Vocabulary'))
const Plan = lazy(() => import('@/pages/Plan'))
const Leaderboard = lazy(() => import('@/pages/Leaderboard'))
const Me = lazy(() => import('@/pages/Me'))
const AIChat = lazy(() => import('@/pages/AIChat'))
const Settings = lazy(() => import('@/pages/Settings'))

// Learning modes — each its own chunk (only loaded on entry)
const FlashcardMode = lazy(() => import('@/pages/modes/FlashcardMode'))
const ListeningMode = lazy(() => import('@/pages/modes/ListeningMode'))
const TimedQuizMode = lazy(() => import('@/pages/modes/TimedQuizMode'))
const SequentialQuizMode = lazy(() => import('@/pages/modes/SequentialQuizMode'))
const VisualMode = lazy(() => import('@/pages/modes/VisualMode'))
const SentenceMakingMode = lazy(() => import('@/pages/modes/SentenceMakingMode'))
const SentencePuzzleMode = lazy(() => import('@/pages/modes/SentencePuzzleMode'))
const TranslationMode = lazy(() => import('@/pages/modes/TranslationMode'))
const HandwritingMode = lazy(() => import('@/pages/modes/HandwritingMode'))
const ShadowingMode = lazy(() => import('@/pages/modes/ShadowingMode'))
const StoryMode = lazy(() => import('@/pages/modes/StoryMode'))
const ConversationMode = lazy(() => import('@/pages/modes/ConversationMode'))
const SmartReviewMode = lazy(() => import('@/pages/modes/SmartReviewMode'))
const ExamMode = lazy(() => import('@/pages/modes/ExamMode'))
const WeakWordsMode = lazy(() => import('@/pages/modes/WeakWordsMode'))

// Admin — entirely separate bundle
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminVocabulary = lazy(() => import('@/pages/admin/AdminVocabulary'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))
const AdminMessages = lazy(() => import('@/pages/admin/AdminMessages'))
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'))

// Fallback shown while a route chunk downloads
function RouteFallback() {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center gap-3"
      style={{ minHeight: '60dvh' }}
    >
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
      >
        <Loader2 className="w-5 h-5 text-white animate-spin" />
      </div>
      <p className="text-sm text-ink-500 dark:text-ink-400">Loading…</p>
    </div>
  )
}

// Catches chunk-load errors and any uncaught render error so a single
// network blip on a lazy chunk never leaves the user staring at a
// white screen. Shows a "Reload" button instead.
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unknown error' }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Surface the error so we can diagnose cold-load failures in the wild.
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

// Non-blocking splash overlay. Rendered on top of <Routes> while auth/db
// are warming up, so the user always sees something (instead of a blank
// page) on a cold first load.
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

function App() {
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
    // Update theme-color meta tag
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement
    if (meta) {
      meta.content = darkMode ? '#0f0720' : '#faf5ff'
    }
  }, [darkMode])

  // Show a non-blocking splash only until we have a real user (registered
  // or guest). Routes still mount underneath, so a slow checkAuth never
  // produces a blank page.
  const showSplash = isLoading && !user

  return (
    <>
      <OfflineBanner />
      <InstallPWA />
      <LocalLLMStatus />
      <AppErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Layout />}>
              <Route index element={<Dashboard />} />
            </Route>
            <Route element={<Layout />}>
              <Route path="/learn" element={<Learn />} />
              <Route path="/mode/flashcard" element={<RateLimitGuard modeId="flashcard" modeName="Flashcard SRS"><FlashcardMode /></RateLimitGuard>} />
              <Route path="/mode/listening" element={<RateLimitGuard modeId="listening" modeName="Listening Practice"><ListeningMode /></RateLimitGuard>} />
              <Route path="/mode/timed-quiz" element={<RateLimitGuard modeId="timed-quiz" modeName="Timed Quiz"><TimedQuizMode /></RateLimitGuard>} />
              <Route path="/mode/sequential-quiz" element={<RateLimitGuard modeId="sequential-quiz" modeName="Sequential Quiz"><SequentialQuizMode /></RateLimitGuard>} />
              <Route path="/mode/visual" element={<RateLimitGuard modeId="visual" modeName="Visual Learning"><VisualMode /></RateLimitGuard>} />
              <Route path="/mode/sentence-making" element={<RateLimitGuard modeId="sentence-making" modeName="Sentence Making"><SentenceMakingMode /></RateLimitGuard>} />
              <Route path="/mode/sentence-puzzle" element={<RateLimitGuard modeId="sentence-puzzle" modeName="Sentence Puzzle"><SentencePuzzleMode /></RateLimitGuard>} />
              <Route path="/mode/translation" element={<RateLimitGuard modeId="translation" modeName="Translation"><TranslationMode /></RateLimitGuard>} />
              <Route path="/mode/handwriting" element={<RateLimitGuard modeId="handwriting" modeName="Handwriting"><HandwritingMode /></RateLimitGuard>} />
              <Route path="/mode/shadowing" element={<RateLimitGuard modeId="shadowing" modeName="Shadowing"><ShadowingMode /></RateLimitGuard>} />
              <Route path="/mode/story" element={<RateLimitGuard modeId="story" modeName="AI Story"><StoryMode /></RateLimitGuard>} />
              <Route path="/mode/conversation" element={<RateLimitGuard modeId="conversation" modeName="AI Conversation"><ConversationMode /></RateLimitGuard>} />
              <Route path="/mode/smart-review" element={<RateLimitGuard modeId="smart-review" modeName="AI Smart Review"><SmartReviewMode /></RateLimitGuard>} />
              <Route path="/mode/exam" element={<RateLimitGuard modeId="exam" modeName="HSK Mock Exam"><ExamMode /></RateLimitGuard>} />
              <Route path="/mode/weak-words" element={<WeakWordsMode />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/vocabulary" element={<Vocabulary />} />
              <Route path="/me" element={<Me />} />
              <Route path="/ai" element={<AIChat />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="vocabulary" element={<AdminVocabulary />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="messages" element={<AdminMessages />} />
            </Route>
            <Route path="/policy" element={<Policy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
      {showSplash && <SplashOverlay />}
      <BaiduAnalytics />
    </>
  )
}

export default App
