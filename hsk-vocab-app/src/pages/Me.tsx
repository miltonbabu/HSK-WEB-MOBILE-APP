import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore, useSettingsStore } from '@/stores'
import { wordService, progressService, authService, sessionService, getUserProfile } from '@/services/sqlite-api'
import { usageService } from '@/services/usage'
import { supabaseProfiles, supabaseMessages } from '@/services/supabase-db'
import { Word, HSKLevel, UserProgress } from '@/types'
import { Moon, BookOpen, Edit3, Check, X, LogIn, UserPlus, User, Mail, Shield, Globe, Volume2, Trash2, Award, Download, Upload, LogOut, Calendar, Sparkles, ExternalLink, GraduationCap, Code, Send, MessageSquare, Loader2, Clock } from 'lucide-react'
import { ACHIEVEMENTS, getUnlockedAchievements } from '@/services/achievements'

const LEVEL_COLORS: Record<HSKLevel, { bg: string; shadow: string }> = {
  1: { bg: '#8b5cf6', shadow: 'rgba(139,92,246,0.35)' },
  2: { bg: '#10b981', shadow: 'rgba(16,185,129,0.35)' },
  3: { bg: '#f59e0b', shadow: 'rgba(245,158,11,0.35)' },
  4: { bg: '#ec4899', shadow: 'rgba(236,72,153,0.35)' },
  5: { bg: '#3b82f6', shadow: 'rgba(59,130,246,0.35)' },
  6: { bg: '#ef4444', shadow: 'rgba(239,68,68,0.35)' },
}

const LEVEL_LABELS: Record<HSKLevel, string> = {
  1: 'Beginner',
  2: 'Elementary',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Upper Advanced',
  6: 'Mastery',
}

const goalOptions = [10, 20, 30, 50]
const timerOptions = [5, 10, 15, 20, 30]
const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5]

export default function Me() {
  const { user, isGuest, login, signup, logout } = useAuthStore()
  const { darkMode, dailyGoal, playbackSpeed, quizTimer, toggleDarkMode, setDailyGoal, setPlaybackSpeed, setQuizTimer } = useSettingsStore()
  const [words, setWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUsername, setEditingUsername] = useState(false)
  const [username, setUsername] = useState(user?.username || '')
  const [showAuth, setShowAuth] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authError, setAuthError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [rank, setRank] = useState<number | null>(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [dbStreak, setDbStreak] = useState(0)
  const [todayUsageSeconds, setTodayUsageSeconds] = useState(0)

  // Contact form state
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMsg, setContactMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    async function loadData() {
      const userId = user?.id || 'guest'
      try {
        const [allWords, userProgress, profile] = await Promise.all([
          wordService.getAll(),
          progressService.getUserProgress(userId),
          getUserProfile(userId).catch(() => null),
        ])
        setWords(allWords)
        setProgress(userProgress)
        if (profile) setDbStreak(profile.streak_count)

        // Rank lookup hits the network — derive learned count from the
        // already-resolved progress, then start it in parallel with
        // the local setState work.
        const myLearned = userProgress.filter((p) => p.mastery_level >= 3).length
        supabaseProfiles
          .getUserRank(userId, myLearned)
          .then((rankData) => {
            setRank(rankData.rank)
            setTotalUsers(rankData.total)
          })
          .catch(() => {
            setRank(null)
            setTotalUsers(0)
          })
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  useEffect(() => {
    setUsername(user?.username || '')
  }, [user?.username])

  // AI usage stats — load for both guests and registered users.
  // Guests: per-mode count (10/mode/day). Registered: time-based (120 min/day).
  useEffect(() => {
    if (!user?.id) {
      setTodayUsageSeconds(0)
      return
    }
    // usageService is synchronous (localStorage-based), so no async needed
    if (isGuest) {
      // Guests don't have a time limit — their usage is per-mode count
      setTodayUsageSeconds(0)
    } else {
      setTodayUsageSeconds(usageService.getTimeUsedSeconds(user.id))
    }
  }, [user?.id, isGuest])

  const getLevelStats = (level: HSKLevel) => {
    const total = words.filter((w) => w.hsk_level === level).length
    const learned = progress.filter(
      (p) => p.mastery_level >= 3 && words.some((w) => w.id === p.word_id && w.hsk_level === level)
    ).length
    return { total, learned }
  }

  const totalLearned = progress.filter((p) => p.mastery_level >= 3).length

  const handleSaveUsername = async () => {
    if (username.trim() && user?.id) {
      try {
        await authService.updateUsername(user.id, username.trim())
        // Update the auth store with new username
        const updatedUser = { ...user, username: username.trim() }
        useAuthStore.setState({ user: updatedUser as any })
        setEditingUsername(false)
      } catch (error: any) {
        console.error('Failed to update username:', error)
      }
    }
  }

  const handleAuth = async () => {
    setAuthError('')
    try {
      if (authMode === 'login') {
        await login(authEmail, authPassword)
      } else {
        await signup(authEmail, authPassword, authUsername)
      }
      setShowAuth(false)
      setAuthEmail('')
      setAuthPassword('')
      setAuthUsername('')
    } catch (error: any) {
      setAuthError(error?.message || 'Authentication failed')
    }
  }

  const handleSendMessage = async () => {
    if (!contactName.trim() || !contactEmail.trim() || !contactMsg.trim()) {
      setSendError('Please fill in all fields')
      return
    }
    setSending(true)
    setSendError('')
    try {
      await supabaseMessages.send({
        name: contactName.trim(),
        email: contactEmail.trim(),
        message: contactMsg.trim(),
        user_id: user?.id !== 'guest' ? user?.id : undefined,
      })
      setSent(true)
      setContactName('')
      setContactEmail('')
      setContactMsg('')
    } catch (err: any) {
      setSendError(err?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-red-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card py-8 text-center"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
            boxShadow: '0 8px 30px rgba(139,92,246,0.4)',
          }}
        >
          {user?.username?.[0]?.toUpperCase() || 'G'}
        </motion.div>

        {editingUsername ? (
          <div className="flex items-center justify-center gap-2 mt-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field !w-40 text-center text-lg font-bold"
              autoFocus
            />
            <button onClick={handleSaveUsername} className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 2px 10px rgba(16,185,129,0.3)' }}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setEditingUsername(false); setUsername(user?.username || '') }}
              className="w-8 h-8 rounded-xl flex items-center justify-center btn-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-4">
            <h1 className="text-xl font-bold text-ink-900 dark:text-white">{username || user?.username || 'Guest'}</h1>
            {!isGuest && (
              <button onClick={() => setEditingUsername(true)} className="w-6 h-6 rounded-full hover:bg-white/40 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
                <Edit3 className="w-3 h-3 text-ink-400" />
              </button>
            )}
          </div>
        )}

        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">{user?.email || 'guest@local'}</p>

        {isGuest ? (
          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium gradient-text">Guest Mode — data saved locally</p>
            {showAuth ? (
              <div className="mt-3 max-w-xs mx-auto space-y-3">
                <div className="flex rounded-xl border border-white/20 dark:border-white/10 overflow-hidden">
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError('') }}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${authMode === 'login' ? 'text-white' : 'text-ink-500 bg-white/30 dark:bg-white/5'}`}
                    style={authMode === 'login' ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' } : undefined}
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => { setAuthMode('signup'); setAuthError('') }}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${authMode === 'signup' ? 'text-white' : 'text-ink-500 bg-white/30 dark:bg-white/5'}`}
                    style={authMode === 'signup' ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' } : undefined}
                  >
                    Sign Up
                  </button>
                </div>
                {authMode === 'signup' && (
                  <input type="text" placeholder="Username…" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} className="input-field text-sm" autoComplete="username" spellCheck={false} />
                )}
                <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="input-field text-sm" autoComplete="email" spellCheck={false} />
                <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="input-field text-sm" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
                {authError && <p className="text-xs text-red-500">{authError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleAuth} className="flex-1 btn-primary text-sm">
                    {authMode === 'login' ? 'Log In' : 'Create Account'}
                  </button>
                  <button onClick={() => setShowAuth(false)} className="btn-secondary text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button onClick={() => { setShowAuth(true); setAuthMode('login') }} className="btn-primary text-sm flex items-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5" /> Log In
                </button>
                <button onClick={() => { setShowAuth(true); setAuthMode('signup') }} className="btn-secondary text-sm flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Sign Up
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-xs text-ink-400 dark:text-ink-500">
              Member since {new Date(user?.created_at || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={logout}
              className="mt-4 flex items-center justify-center gap-2 mx-auto px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                boxShadow: '0 4px 15px rgba(139,92,246,0.35)',
              }}
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </motion.button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { value: dbStreak, label: 'Day Streak', gradient: 'from-red-500 to-amber-500' },
            { value: totalLearned, label: 'Words Learned', gradient: 'from-emerald-400 to-teal-500' },
            { value: rank !== null ? `#${rank}` : '-', label: `Rank (of ${totalUsers})`, gradient: 'from-amber-400 to-orange-500' },
          ].map((stat) => (
            <div key={stat.label} className="card-glass !p-3">
              <p className="text-xl font-bold gradient-text">{stat.value}</p>
              <p className="text-[10px] text-ink-400 dark:text-ink-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {user?.id && (() => {
        const totalUsed = Math.floor(todayUsageSeconds / 60)
        const dailyMinutes = usageService.getDailyMinutes()
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glass rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-ink-900 dark:text-white text-sm">Today's AI Usage</h3>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold">
                {isGuest ? 'Guest' : 'Free'}
              </span>
            </div>
            <div className="space-y-2">
              {isGuest ? (
                <>
                  {/* Guest: per-mode count */}
                  {(() => {
                    const counts = usageService.getModeCounts(user.id)
                    const modeLabels: Record<string, string> = {
                      chat: 'Free Chat',
                      conversation: 'Conversation',
                      grammar: 'Grammar',
                      'sequential-quiz': 'Sequential Quiz',
                      translation: 'Translation',
                      'sentence-puzzle': 'Sentence Puzzle',
                    }
                    const modeLimit = usageService.getModeLimit()
                    const usedModes = Object.entries(counts).filter(([, v]) => v > 0)
                    if (usedModes.length === 0) {
                      return (
                        <p className="text-[11px] text-ink-500 dark:text-ink-400">
                          You get 10 uses per AI mode per day. Start chatting to see your usage!
                        </p>
                      )
                    }
                    return usedModes.map(([mode, count]) => (
                      <div key={mode}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-ink-500 dark:text-ink-400">{modeLabels[mode] || mode}</span>
                          <span className="font-semibold text-ink-900 dark:text-white">
                            {count} / {modeLimit}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200/60 dark:bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (count / modeLimit) * 100)}%`,
                              background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)',
                            }}
                          />
                        </div>
                      </div>
                    ))
                  })()}
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 pt-1">
                    10 uses per AI mode per day. Sign up for 2 hours of unlimited AI access daily.
                  </p>
                </>
              ) : (
                <>
                  {/* Registered: time-based */}
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-500 dark:text-ink-400">Total AI time</span>
                    <span className="font-semibold text-ink-900 dark:text-white">
                      {totalUsed} / {dailyMinutes} min
                    </span>
                  </div>
                  <div className="w-full bg-gray-200/60 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (totalUsed / dailyMinutes) * 100)}%`,
                        background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 pt-1">
                    2 hours of unlimited AI features per day. Renews daily.
                  </p>
                </>
              )}
              {isGuest && (
                <Link
                  to="/auth?mode=signup"
                  className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
                >
                  <Sparkles className="w-3 h-3" /> Sign Up Free
                </Link>
              )}
            </div>
          </motion.div>
        )
      })()}

      {/* Mobile-only quick links */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <Link to="/plan" className="card card-hover">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                boxShadow: '0 4px 15px rgba(139,92,246,0.35)',
              }}
            >
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Study Plan</h2>
              <p className="text-[10px] text-ink-500 dark:text-ink-400">Your learning plan</p>
            </div>
          </div>
        </Link>
        <Link to="/ai" className="card card-hover">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                boxShadow: '0 4px 15px rgba(59,130,246,0.35)',
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">AI Assistant</h2>
              <p className="text-[10px] text-ink-500 dark:text-ink-400">Chat & get help</p>
            </div>
          </div>
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">HSK Level Progress</h2>
        </div>
        <div className="space-y-3">
          {([1, 2, 3, 4] as HSKLevel[]).map((level) => {
            const stats = getLevelStats(level)
            const pct = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0
            const color = LEVEL_COLORS[level]
            return (
              <div key={level}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}dd 100%)` }}
                    >
                      {level}
                    </span>
                    <span className="text-sm font-medium text-ink-700 dark:text-ink-300">HSK {level}</span>
                    <span className="text-[11px] text-ink-400">{LEVEL_LABELS[level]}</span>
                  </div>
                  <span className="text-xs font-semibold text-ink-500 dark:text-ink-400">{stats.learned}/{stats.total}</span>
                </div>
                <div className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${color.bg} 0%, ${color.bg}dd 100%)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">Achievements</h2>
          <span className="ml-auto text-xs font-medium text-ink-400 dark:text-ink-500">
            {getUnlockedAchievements().length} / {ACHIEVEMENTS.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
          {ACHIEVEMENTS.map((achievement) => {
            const unlocked = getUnlockedAchievements().includes(achievement.id)
            return (
              <div
                key={achievement.id}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl text-center transition-all ${
                  unlocked
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-700/30'
                    : 'bg-ink-50/50 dark:bg-white/5 border border-transparent opacity-50'
                }`}
                title={achievement.description}
              >
                <span className="text-2xl">{unlocked ? achievement.icon : '🔒'}</span>
                <span className={`text-[11px] font-medium leading-tight ${unlocked ? 'text-ink-700 dark:text-ink-300' : 'text-ink-400 dark:text-ink-500'}`}>
                  {achievement.name}
                </span>
              </div>
            )
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card"
      >
        <div className="flex items-center gap-3">
          <Moon className="w-5 h-5 text-ink-500 dark:text-ink-400" />
          <div>
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">Appearance</h2>
            <p className="text-xs text-ink-400 dark:text-ink-500">Switch between light and dark themes</p>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative ml-auto w-12 h-7 rounded-full transition-all duration-500 ${
              darkMode ? '' : 'bg-ink-200 dark:bg-ink-700'
            }`}
            style={darkMode ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' } : undefined}
            role="switch"
            aria-checked={darkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-500 ${
                darkMode ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">Daily Goal</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">Set how many words you want to study each day</p>
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((goal) => (
            <motion.button
              key={goal}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDailyGoal(goal)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                dailyGoal === goal ? 'pill-active' : 'pill-inactive'
              }`}
            >
              {goal} words
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card"
      >
        <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">Quiz Timer</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">Default time limit per question in timed quiz</p>
        <div className="flex flex-wrap gap-2">
          {timerOptions.map((seconds) => (
            <motion.button
              key={seconds}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setQuizTimer(seconds)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                quizTimer === seconds ? 'pill-active' : 'pill-inactive'
              }`}
            >
              {seconds}s
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-4">
          <Volume2 className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">Audio Playback Speed</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">Adjust the speed for listening practice</p>
        <div className="flex flex-wrap gap-2">
          {speedOptions.map((speed) => (
            <motion.button
              key={speed}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                playbackSpeed === speed ? 'pill-active' : 'pill-inactive'
              }`}
            >
              {speed}x
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* HSK Learning Resources */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.33 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
            }}
          >
            <GraduationCap className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">HSK Learning Resources</h2>
            <p className="text-xs text-ink-400 dark:text-ink-500">Official study materials & grammar guides</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: 'HSK Resources', href: 'https://www.ncwu.site/hsk', desc: 'Comprehensive HSK study materials & vocabulary lists', color: '#8b5cf6' },
            { label: 'HSK 2026 Updates', href: 'https://www.ncwu.site/hsk-2026', desc: 'Latest HSK 3.0 exam format, levels & vocabulary changes', color: '#3b82f6' },
            { label: 'Chinese Grammar Guide', href: 'https://www.ncwu.site/hsk/grammar', desc: 'Essential grammar points for all HSK levels', color: '#10b981' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group hover:bg-ink-50/50 dark:hover:bg-white/5"
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: link.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 dark:text-ink-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  {link.label}
                </p>
                <p className="text-[11px] text-ink-400 dark:text-ink-500 truncate">{link.desc}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-ink-300 dark:text-ink-600 flex-shrink-0 group-hover:text-red-500 transition-colors" />
            </a>
          ))}
        </div>
      </motion.div>

      {/* Contact / Support */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
            }}
          >
            <MessageSquare className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">Contact Support</h2>
            <p className="text-xs text-ink-400 dark:text-ink-500">Have a question or feedback? We'll get back to you.</p>
          </div>
        </div>
        {sent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-semibold text-ink-900 dark:text-white">Message Sent!</p>
            <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">We'll get back to you soon.</p>
            <button
              onClick={() => setSent(false)}
              className="mt-3 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              Send another message
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Your Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="input-field text-sm"
                autoComplete="name"
                spellCheck={false}
              />
              <input
                type="email"
                placeholder="Your Email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="input-field text-sm"
                autoComplete="email"
                spellCheck={false}
              />
            </div>
            <textarea
              placeholder="Your Message…"
              value={contactMsg}
              onChange={(e) => setContactMsg(e.target.value)}
              rows={3}
              className="input-field text-sm resize-none"
              spellCheck={false}
            />
            {sendError && <p className="text-xs text-red-500">{sendError}</p>}
            <button
              onClick={handleSendMessage}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                boxShadow: '0 4px 15px rgba(59,130,246,0.3)',
              }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        )}
      </motion.div>

      {!isGuest && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card space-y-1"
        >
          <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-3">Account</h2>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/50 dark:bg-white/5">
            <User className="w-5 h-5 text-ink-400" />
            <div className="flex-1">
              <p className="text-xs text-ink-400 dark:text-ink-500">Username</p>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-300">{user?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/50 dark:bg-white/5">
            <Mail className="w-5 h-5 text-ink-400" />
            <div className="flex-1">
              <p className="text-xs text-ink-400 dark:text-ink-500">Email</p>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-300">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/50 dark:bg-white/5">
            <Shield className="w-5 h-5 text-ink-400" />
            <div className="flex-1">
              <p className="text-xs text-ink-400 dark:text-ink-500">Account Type</p>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-300">Standard User</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/50 dark:bg-white/5">
            <Globe className="w-5 h-5 text-ink-400" />
            <div className="flex-1">
              <p className="text-xs text-ink-400 dark:text-ink-500">Member Since</p>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-300">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card"
      >
        <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">About</h2>
        <div className="space-y-2 text-sm text-ink-600 dark:text-ink-400">
          <p>XueTong — A comprehensive vocabulary learning app for the HSK (Hanyu Shuiping Kaoshi) Chinese proficiency test.</p>
          <p>Features spaced repetition (SRS), multiple quiz modes, and progress tracking across all new HSK levels (1-4).</p>
          <p className="text-xs mt-3 text-ink-400">Version 1.0.0</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="card"
      >
        <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">Data Management</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">Export your progress for backup or import from a previous backup</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={async () => {
              try {
                const userId = user?.id || 'guest'
                const userProgress = await progressService.getUserProgress(userId)
                const sessions = await sessionService.getStats(userId, 365)
                const achievements = getUnlockedAchievements()
                const data = {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  progress: userProgress,
                  sessions,
                  achievements,
                  settings: { dailyGoal, playbackSpeed, quizTimer, darkMode },
                }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `hsk-progress-${new Date().toISOString().split('T')[0]}.json`
                a.click()
                URL.revokeObjectURL(url)
              } catch (error) {
                console.error('Export failed:', error)
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.12) 100%)',
              border: '1px solid rgba(139,92,246,0.15)',
              color: '#8b5cf6',
            }}
          >
            <Download className="w-4 h-4" />
            Export Progress
          </button>
          <label
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm transition-all cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.12) 100%)',
              border: '1px solid rgba(16,185,129,0.15)',
              color: '#10b981',
            }}
          >
            <Upload className="w-4 h-4" />
            Import Progress
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const data = JSON.parse(text)
                  if (data.progress && Array.isArray(data.progress)) {
                    const userId = user?.id || 'guest'
                    for (const p of data.progress) {
                      await progressService.updateProgress({ word_id: p.word_id, mastery_level: p.mastery_level, easiness_factor: p.easiness_factor, interval: p.interval, next_review: p.next_review }, userId)
                    }
                    if (data.achievements) {
                      localStorage.setItem('hsk-achievements', JSON.stringify(data.achievements))
                    }
                    window.location.reload()
                  }
                } catch (error) {
                  console.error('Import failed:', error)
                }
              }}
            />
          </label>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.48 }}
        className="card space-y-3"
      >
        <h2 className="text-base font-semibold text-ink-900 dark:text-white">Danger Zone</h2>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.12) 100%)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#ef4444',
            }}
          >
            <Trash2 className="w-4 h-4" />
            {isGuest ? 'Clear Guest Data' : 'Delete Account'}
          </button>
        ) : (
          <div className="p-4 rounded-2xl space-y-3" style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.15) 100%)',
            border: '1px solid rgba(239,68,68,0.25)',
          }}>
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              {isGuest ? 'This will clear all your local progress. Are you sure?' : 'This will permanently delete your account and all progress. Are you sure?'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-300"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    if (!isGuest && user?.id) {
                      await authService.deleteUser(user.id)
                    }
                    logout()
                  } catch (error) {
                    console.error('Failed to delete account:', error)
                    logout()
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white shadow-md shadow-red-500/30"
              >
                {isGuest ? 'Clear Data' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Developer Credit */}
      <a
        href="https://miltonbabu.site"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card card-hover"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
              }}
            >
              <Code className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-ink-400 dark:text-ink-500">Developed by</p>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400 transition-colors">
                BABU MD MILTON
              </span>
            </div>
            <ExternalLink className="w-4 h-4 text-ink-300 dark:text-ink-600 flex-shrink-0" />
          </div>
        </motion.div>
      </a>
    </div>
  )
}