import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useAuthStore, useSettingsStore, useProgressStore } from '@/stores'
import { wordService, progressService, getAllUserProfiles, getTodayProgress, getDueReviewCount, getWeakWords, sessionService, getUserProfile } from '@/services/sqlite-api'
import { Word, HSKLevel, UserProgress } from '@/types'
import { checkAndUnlockAchievements, Achievement, AchievementStats } from '@/services/achievements'
import { Target, BookOpen, Flame, Sparkles, Layers, Headphones, Timer, Pencil, Trophy, RotateCcw, AlertCircle } from 'lucide-react'
import Onboarding from '@/pages/Onboarding'

const LEVEL_COLORS: Record<HSKLevel, string> = {
  1: '#8b5cf6',
  2: '#10b981',
  3: '#f59e0b',
  4: '#ec4899',
  5: '#3b82f6',
  6: '#ef4444',
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { dailyGoal, setDailyGoal } = useSettingsStore()
  const { setSelectedLevel } = useProgressStore()
  const [words, setWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [todayStats, setTodayStats] = useState({ wordsStudied: 0, accuracy: 0, duration: 0 })
  const [loading, setLoading] = useState(true)
  const [rank, setRank] = useState<number | null>(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [dueReviewCount, setDueReviewCount] = useState(0)
  const [weakWords, setWeakWords] = useState<Word[]>([])
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarding_complete'))
  const [dbStreak, setDbStreak] = useState(0)

  const handleOnboardingComplete = (data: { levels: number[]; dailyGoal: number; learningReason: string; createPlan: boolean }) => {
    localStorage.setItem('onboarding_complete', 'true')
    localStorage.setItem('hsk_level', String(data.levels[0] || 1))
    localStorage.setItem('learning_reason', data.learningReason || '')
    localStorage.setItem('personalized_plan', String(data.createPlan))
    setDailyGoal(data.dailyGoal)
    if (data.levels.length > 0) {
      setSelectedLevel(data.levels[0] as HSKLevel)
    }
    setShowOnboarding(false)
  }

  const handleOnboardingSkip = () => {
    localStorage.setItem('onboarding_complete', 'true')
    setShowOnboarding(false)
  }
  useEffect(() => {
    async function loadData() {
      try {
        const allWords = await wordService.getAll()
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        setWords(allWords)
        setProgress(userProgress)

        // Load today's real stats
        const today = await getTodayProgress(user?.id || 'guest')
        setTodayStats(today)

        // Load real streak from database
        try {
          const profile = await getUserProfile(user?.id || 'guest')
          if (profile) {
            setDbStreak(profile.streak_count)
          }
        } catch { /* ignore */ }

        // Due reviews
        const dueCount = await getDueReviewCount(user?.id || 'guest')
        setDueReviewCount(dueCount)

        // Weak words
        const weak = await getWeakWords(user?.id || 'guest', 5)
        setWeakWords(weak)

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

        // Check achievements
        try {
          const allSessions = await sessionService.getStats(user?.id || 'guest', 3650) // all sessions up to ~10 years
          const totalWordsLearned = userProgress.filter((p) => p.mastery_level >= 3).length
          const currentStreak = user?.streak_count || 0
          const totalSessions = allSessions.length
          const perfectQuizzes = allSessions.filter((s) => s.accuracy === 100).length
          const levelsStudied = ([1, 2, 3, 4] as HSKLevel[]).filter((level) =>
            userProgress.some((p) => p.mastery_level >= 1 && allWords.some((w) => w.id === p.word_id && w.hsk_level === level))
          )
          const totalStudyTime = allSessions.reduce((sum, s) => sum + (s.duration || 0), 0)

          const stats: AchievementStats = {
            totalWordsLearned,
            currentStreak,
            totalSessions,
            perfectQuizzes,
            levelsStudied,
            totalStudyTime,
          }
          const unlocked = checkAndUnlockAchievements(stats)
          if (unlocked.length > 0) {
            setNewAchievements(unlocked)
          }
        } catch (e) {
          console.error('Failed to check achievements:', e)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  const levelData = ([1, 2, 3, 4] as HSKLevel[]).map((level) => {
    const levelWords = words.filter((w) => w.hsk_level === level)
    const learnedWords = progress.filter(
      (p) => p.mastery_level >= 3 && levelWords.some((w) => w.id === p.word_id)
    )
    return {
      level: `HSK ${level}`,
      learned: learnedWords.length,
      total: levelWords.length,
      remaining: Math.max(0, levelWords.length - learnedWords.length),
      color: LEVEL_COLORS[level],
    }
  })

  const masteryData = [
    { name: 'New', value: progress.filter((p) => p.mastery_level === 0).length, color: '#c3c4cd' },
    { name: 'Learning', value: progress.filter((p) => p.mastery_level === 1).length, color: '#f59e0b' },
    { name: 'Reviewing', value: progress.filter((p) => p.mastery_level === 2).length, color: '#8b5cf6' },
    { name: 'Familiar', value: progress.filter((p) => p.mastery_level === 3).length, color: '#ec4899' },
    { name: 'Mastered', value: progress.filter((p) => p.mastery_level >= 4).length, color: '#10b981' },
  ].filter(d => d.value > 0)

  const totalLearned = progress.filter((p) => p.mastery_level >= 3).length
  const todayProgress = Math.min((todayStats.wordsStudied / dailyGoal) * 100, 100)
  const goalMet = todayStats.wordsStudied >= dailyGoal

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Guest mode banner */}
      {(!user || user.id === 'guest') && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-4 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(236,72,153,0.1) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(139,92,246,0.2)',
          }}
        >
          <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0" />
          <p className="text-purple-700 dark:text-purple-300 text-sm">
            <span className="font-semibold">Guest Mode</span> — progress saved locally.{' '}
            <Link to="/auth" className="underline hover:no-underline font-medium">
              Sign up free
            </Link>{' '}
            to sync across devices.
          </p>
        </motion.div>
      )}

      {/* Daily goal celebration */}
      {goalMet && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl p-4 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(52,211,153,0.1) 100%)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}
        >
          <span className="text-2xl">🎉</span>
          <p className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            Daily goal reached! You studied {todayStats.wordsStudied} words today.
          </p>
        </motion.div>
      )}

      {/* Achievement celebration */}
      {newAchievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(249,115,22,0.1) 100%)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🏅</span>
            <p className="text-amber-700 dark:text-amber-300 text-sm font-semibold">
              {newAchievements.length === 1 ? 'New Achievement Unlocked!' : `${newAchievements.length} New Achievements Unlocked!`}
            </p>
            <button
              onClick={() => setNewAchievements([])}
              className="ml-auto text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 text-xs font-medium"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {newAchievements.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-amber-100/60 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-700/30 text-amber-800 dark:text-amber-200"
              >
                <span>{a.icon}</span>
                {a.name}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Target, label: "Today's Progress", value: todayStats.wordsStudied, unit: `/ ${dailyGoal} words`, colors: ['#8b5cf6', '#ec4899'], shadow: 'rgba(139,92,246,0.3)', pct: todayProgress, sub: todayStats.accuracy > 0 ? `${todayStats.accuracy}% accuracy` : null },
          { icon: BookOpen, label: 'Total Learned', value: totalLearned, unit: `/ ${words.length} words`, colors: ['#34d399', '#14b8a6'], shadow: 'rgba(16,185,129,0.3)', pct: words.length > 0 ? Math.round((totalLearned / words.length) * 100) : 0, sub: `${words.length > 0 ? Math.round((totalLearned / words.length) * 100) : 0}% complete` },
          { icon: Flame, label: 'Study Streak', value: dbStreak, unit: 'days', colors: ['#fbbf24', '#f97316'], shadow: 'rgba(245,158,11,0.3)', pct: 0, sub: dbStreak ? 'Keep it up!' : 'Start today!' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card card-hover"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${stat.colors[0]} 0%, ${stat.colors[1]} 100%)`,
                  boxShadow: `0 4px 15px ${stat.shadow}`,
                }}
              >
                <stat.icon className="w-[18px] h-[18px] text-white" />
              </div>
              <h3 className="text-sm font-medium text-ink-500 dark:text-ink-400">{stat.label}</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-ink-900 dark:text-white">{stat.value}</span>
              <span className="text-sm text-ink-400 dark:text-ink-500 mb-1">{stat.unit}</span>
            </div>
            {i < 2 && (
              <div className="mt-3 h-1.5 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${stat.colors[0]} 0%, ${stat.colors[1]} 100%)`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${stat.pct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            )}
            {stat.sub && (
              <p className="mt-2 text-sm font-medium gradient-text">{stat.sub}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Review reminder */}
      {dueReviewCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <Link
            to="/mode/flashcard"
            className="card card-hover flex items-center gap-4 p-4"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.05) 100%)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
              }}
            >
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-white">{dueReviewCount} words due for review</h3>
              <p className="text-xs text-ink-500 dark:text-ink-400">Start flashcard review to keep your streak going</p>
            </div>
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Review Now →</span>
          </Link>
        </motion.div>
      )}

      {/* Rank */}
      {rank !== null && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
                boxShadow: '0 4px 15px rgba(245,158,11,0.3)',
              }}
            >
              <Trophy className="w-[18px] h-[18px] text-white" />
            </div>
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">Your Rank</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-ink-900 dark:text-white">#{rank}</p>
              <p className="text-sm text-ink-400 dark:text-ink-500">out of {totalUsers} users</p>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #fbbf24 0%, #f97316 100%)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${totalUsers > 0 ? Math.max(((totalUsers - rank + 1) / totalUsers) * 100, 5) : 0}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <p className="mt-2 text-sm font-medium gradient-text">
                {rank === 1 ? 'You are the top learner!' : rank <= 3 ? 'Almost at the top!' : 'Keep learning to climb the ranks!'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">Level Progress</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelData} layout="vertical" barSize={28} barGap={4}>
                <XAxis type="number" domain={[0, 'dataMax']} hide />
                <YAxis type="category" dataKey="level" width={52} tick={{ fontSize: 13, fill: '#787a8b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                  }}
                  formatter={(value: number, name: string) => [`${value} ${name}`, name === 'learned' ? 'Learned' : 'Remaining']}
                />
                <Bar dataKey="learned" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="remaining" stackId="a" fill="rgba(225,226,230,0.5)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            {levelData.map((l) => (
              <div key={l.level} className="text-center">
                <div className="text-lg font-bold text-ink-900 dark:text-white">{l.learned}</div>
                <div className="text-xs text-ink-400 dark:text-ink-500">{l.level}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="card"
        >
          <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">Mastery</h2>
          {masteryData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-ink-400 text-sm">
              Start learning to see mastery data
            </div>
          ) : (
            <div className="h-60 flex items-center">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie data={masteryData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                    {masteryData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 flex-1">
                {masteryData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-ink-500 dark:text-ink-400 flex-1">{item.name}</span>
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Weak Words */}
      {weakWords.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                  boxShadow: '0 4px 15px rgba(239,68,68,0.3)',
                }}
              >
                <AlertCircle className="w-[18px] h-[18px] text-white" />
              </div>
              <h2 className="text-base font-semibold text-ink-900 dark:text-white">Weak Words</h2>
            </div>
            <Link to="/mode/flashcard" className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">
              Practice All →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {weakWords.map((w) => (
              <Link
                key={w.id}
                to="/mode/flashcard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-ink-700 dark:text-ink-300 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              >
                <span className="font-bold chinese-text">{w.chinese}</span>
                <span className="text-xs text-ink-400">{w.pinyin}</span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Start */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">Quick Start</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/mode/flashcard', icon: Layers, label: 'Flashcards', colors: ['#8b5cf6', '#7c3aed'], shadow: 'rgba(139,92,246,0.3)' },
            { to: '/mode/listening', icon: Headphones, label: 'Listening', colors: ['#34d399', '#14b8a6'], shadow: 'rgba(16,185,129,0.3)' },
            { to: '/mode/timed-quiz', icon: Timer, label: 'Timed Quiz', colors: ['#fbbf24', '#f97316'], shadow: 'rgba(245,158,11,0.3)' },
            { to: '/mode/visual', icon: Pencil, label: 'Visual', colors: ['#f472b6', '#f43f5e'], shadow: 'rgba(236,72,153,0.3)' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card-glass card-hover flex flex-col items-center gap-2.5 p-4 group"
            >
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${item.colors[0]} 0%, ${item.colors[1]} 100%)`,
                  boxShadow: `0 4px 12px ${item.shadow}`,
                }}
              >
                <item.icon className="w-5 h-5 text-white" />
              </motion.div>
              <span className="text-sm font-semibold text-ink-700 dark:text-ink-300 group-hover:text-ink-900 dark:group-hover:text-white transition-colors">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      )}
    </div>
  )
}
