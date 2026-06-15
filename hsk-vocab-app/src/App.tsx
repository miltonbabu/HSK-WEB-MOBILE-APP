import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore, useSettingsStore } from '@/stores'
import Layout from '@/components/Layout'
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
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="learn" element={<Learn />} />
        <Route path="mode/flashcard" element={<FlashcardMode />} />
        <Route path="mode/listening" element={<ListeningMode />} />
        <Route path="mode/timed-quiz" element={<TimedQuizMode />} />
        <Route path="mode/sequential-quiz" element={<SequentialQuizMode />} />
        <Route path="mode/visual" element={<VisualMode />} />
        <Route path="mode/sentence-making" element={<SentenceMakingMode />} />
        <Route path="mode/sentence-puzzle" element={<SentencePuzzleMode />} />
        <Route path="mode/translation" element={<TranslationMode />} />
        <Route path="mode/handwriting" element={<HandwritingMode />} />
        <Route path="mode/shadowing" element={<ShadowingMode />} />
        <Route path="plan" element={<Plan />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="vocabulary" element={<Vocabulary />} />
        <Route path="me" element={<Me />} />
        <Route path="ai" element={<AIChat />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="vocabulary" element={<AdminVocabulary />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App