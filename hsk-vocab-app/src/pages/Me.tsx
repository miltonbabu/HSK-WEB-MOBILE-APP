import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore, useSettingsStore } from '@/stores'
import { wordService, progressService, getAllUserProfiles, authService, sessionService, getUserProfile } from '@/services/sqlite-api'
import { Word, HSKLevel, UserProgress } from '@/types'
import { Moon, BookOpen, Edit3, Check, X, LogIn, UserPlus, User, Mail, Shield, Globe, Volume2, Trash2, Award, Download, Upload } from 'lucide-react'
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

  useEffect(() => {
    async function loadData() {
      try {
        const allWords = await wordService.getAll()
        setWords(allWords)
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        setProgress(userProgress)

        // Load real streak from database
        try {
          const profile = await getUserProfile(user?.id || 'guest')
          if (profile) {
            setDbStreak(profile.streak_count)
          }
        } catch { /* ignore */ }

        // Calculate rank
        try {
          const allUsers = await getAllUserProfiles()
          const userScores: { id: string; learned: number }[] = []
          for (const u of allUsers) {
            const uProgress = await progressService.getUserProgress(u.id)
            const learned = uProgress.filter((p) => p.mastery_level >= 3).length
            userScores.push({ id: u.id, learned })
          }
          const myLearned = userProgress.filter((p) => p.mastery_level >= 3).length
          const myId = user?.id || 'guest'
          if (!userScores.find((s) => s.id === myId)) {
            userScores.push({ id: myId, learned: myLearned })
          } else {
            userScores.find((s) => s.id === myId)!.learned = myLearned
          }
          userScores.sort((a, b) => b.learned - a.learned)
          const myRank = userScores.findIndex((s) => s.id === myId) + 1
          setRank(myRank)
          setTotalUsers(userScores.length)
        } catch {
          setRank(null)
          setTotalUsers(0)
        }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
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
                  <input type="text" placeholder="Username" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} className="input-field text-sm" />
                )}
                <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="input-field text-sm" />
                <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="input-field text-sm" />
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
            <p className="text-xs text-ink-400">
              Member since {new Date(user?.created_at || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { value: dbStreak, label: 'Day Streak', gradient: 'from-purple-500 to-pink-500' },
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

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-5 h-5 text-purple-500" />
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
          <p>My HSK — A comprehensive vocabulary learning app for the HSK (Hanyu Shuiping Kaoshi) Chinese proficiency test.</p>
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
    </div>
  )
}