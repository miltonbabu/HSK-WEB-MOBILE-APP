import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore, useSettingsStore } from '@/stores'
import Layout from '@/components/Layout'
import OfflineBanner from '@/components/OfflineBanner'
import InstallPWA from '@/components/InstallPWA'
import LocalLLMStatus from '@/components/LocalLLMStatus'
import Dashboard from '@/pages/Dashboard'
import Vocabulary from '@/pages/Vocabulary'
import Auth from '@/pages/Auth'
import Learn from '@/pages/Learn'
import FlashcardMode from '@/pages/modes/FlashcardMode'
import ListeningMode from '@/pages/modes/ListeningMode'
import TimedQuizMode from '@/pages/modes/TimedQuizMode'
import SequentialQuizMode from '@/pages/modes/SequentialQuizMode'
import VisualMode from '@/pages/modes/VisualMode'
import SentenceMakingMode from '@/pages/modes/SentenceMakingMode'
import SentencePuzzleMode from '@/pages/modes/SentencePuzzleMode'
import TranslationMode from '@/pages/modes/TranslationMode'
import HandwritingMode from '@/pages/modes/HandwritingMode'
import ShadowingMode from '@/pages/modes/ShadowingMode'
import StoryMode from '@/pages/modes/StoryMode'
import ConversationMode from '@/pages/modes/ConversationMode'
import SmartReviewMode from '@/pages/modes/SmartReviewMode'
import Plan from '@/pages/Plan'
import Leaderboard from '@/pages/Leaderboard'
import Me from '@/pages/Me'
import AIChat from '@/pages/AIChat'
import Settings from '@/pages/Settings'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminLayout from '@/pages/admin/AdminLayout'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminVocabulary from '@/pages/admin/AdminVocabulary'
import AdminSettings from '@/pages/admin/AdminSettings'
import AdminMessages from '@/pages/admin/AdminMessages'
import Policy from '@/pages/Policy'
import Landing from '@/pages/Landing'
import BaiduAnalytics from '@/components/SEO/BaiduAnalytics'
import RateLimitGuard from '@/components/RateLimitGuard'

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

  // Only show loading screen when we truly have no user yet
  // (avoids flash after login/signup when checkAuth re-runs)
  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 30%, #f0fdf4 60%, #fff7ed 100%)',
      }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[400px] h-[400px] top-[-10%] left-[-5%] rounded-full animate-float" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute w-[350px] h-[350px] bottom-[-10%] right-[-5%] rounded-full animate-float-delayed" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <div className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', boxShadow: '0 8px 25px rgba(139,92,246,0.4)' }}>
          汉
        </div>
        <div className="relative z-10 animate-spin rounded-full h-8 w-8 border-[3px] border-purple-500/30 border-t-purple-500" />
      </div>
    )
  }

  return (
    <>
      <OfflineBanner />
      <InstallPWA />
      <LocalLLMStatus />
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Layout />}>
        <Route index element={<Dashboard />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/learn" element={<Learn />} />
        <Route path="/mode/flashcard" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="flashcard" modeName="Flashcard SRS"><FlashcardMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/listening" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="listening" modeName="Listening Practice"><ListeningMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/timed-quiz" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="timed-quiz" modeName="Timed Quiz"><TimedQuizMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/sequential-quiz" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="sequential-quiz" modeName="Sequential Quiz"><SequentialQuizMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/visual" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="visual" modeName="Visual Learning"><VisualMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/sentence-making" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="sentence-making" modeName="Sentence Making"><SentenceMakingMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/sentence-puzzle" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="sentence-puzzle" modeName="Sentence Puzzle"><SentencePuzzleMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/translation" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="translation" modeName="Translation"><TranslationMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/handwriting" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="handwriting" modeName="Handwriting"><HandwritingMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/shadowing" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="shadowing" modeName="Shadowing"><ShadowingMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/story" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="story" modeName="AI Story"><StoryMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/conversation" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="conversation" modeName="AI Conversation"><ConversationMode /></RateLimitGuard>} />
        </Route>
        <Route path="/mode/smart-review" element={<Layout />}>
          <Route index element={<RateLimitGuard modeId="smart-review" modeName="AI Smart Review"><SmartReviewMode /></RateLimitGuard>} />
        </Route>
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
        <Route path="users" element={<AdminUsers />} />
        <Route path="vocabulary" element={<AdminVocabulary />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="messages" element={<AdminMessages />} />
      </Route>
      <Route path="/policy" element={<Policy />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BaiduAnalytics />
    </>
  )
}

export default App