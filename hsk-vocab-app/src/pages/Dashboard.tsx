import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useAuthStore, useSettingsStore, useProgressStore } from '@/stores'
import { wordService, progressService, getTodayProgress, getDueReviewCount, getWeakWords, sessionService, getUserProfile } from '@/services/sqlite-api'
import { supabaseProfiles } from '@/services/supabase-db'
import { Word, HSKLevel, UserProgress } from '@/types'
import { checkAndUnlockAchievements, Achievement, AchievementStats } from '@/services/achievements'
import { Target, BookOpen, Flame, GraduationCap, Layers, Headphones, Trophy, RotateCcw, AlertCircle, Sparkles, Brain, Loader2, MessageSquare, Heart, Power } from 'lucide-react'
import { generateDailyDigest, DailyDigest } from '@/services/ai-features'
import Onboarding from '@/pages/Onboarding'
import SEO from '@/components/SEO/Helmet'
import { PAGE_SEO } from '@/utils/seo'

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
  const [digest, setDigest] = useState<DailyDigest | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)
  // AI Digest is opt-in to avoid burning LLM tokens for users who don't
  // want it. The toggle is persisted in localStorage.
  const [digestEnabled, setDigestEnabled] = useState(() => localStorage.getItem('ai_digest_enabled') === 'true')
  // Store the data needed to generate the digest so we can trigger it
  // on-demand when the user toggles it on after the initial load.
  const digestDataRef = useRef<{
    todayStats: { wordsStudied: number; accuracy: number; duration: number }
    weak: Word[]
    streak: number
    totalLearned: number
    level: number
  } | null>(null)

  const handleOnboardingComplete = (data: { levels: number[]; dailyGoal: number; learningReason: string; createPlan: boolean }) => {
    localStorage.setItem('onboarding_complete', 'true')
    localStorage.setItem('hsk_level', String(data.levels[0] || 1))
    localStorage.setItem('learning_reason', data.learningReason || '')
    localStorage.setItem('personalized_plan', String(data.createPlan))
    // Also persist daily_goal to localStorage so buildUserContext() in
    // ai-chat.ts can read it when personalising AI responses. The Zustand
    // store (hsk-settings) is a separate persistence layer that
    // buildUserContext does not read from.
    localStorage.setItem('daily_goal', String(data.dailyGoal))
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

  // Toggle AI Digest on/off. When turning on, immediately generate the
  // digest using the stashed data (if available). When turning off, clear
  // the existing digest so the card collapses.
  const toggleDigest = () => {
    const next = !digestEnabled
    setDigestEnabled(next)
    localStorage.setItem('ai_digest_enabled', String(next))
    if (next) {
      const data = digestDataRef.current
      if (data) {
        setDigestLoading(true)
        generateDailyDigest(data.todayStats, data.weak, data.streak, data.totalLearned, data.level)
          .then((d) => setDigest(d))
          .catch(() => {})
          .finally(() => setDigestLoading(false))
      }
    } else {
      setDigest(null)
    }
  }
  useEffect(() => {
    async function loadData() {
      const userId = user?.id || 'guest'
      try {
        // Kick off all independent reads in parallel — the slowest one
        // dominates the total wait time instead of each one stacking up.
        const [
          allWords,
          userProgress,
          today,
          profile,
          dueCount,
          weak,
          allSessions,
          recentSessions,
        ] = await Promise.all([
          wordService.getAll(),
          progressService.getUserProgress(userId),
          getTodayProgress(userId),
          getUserProfile(userId).catch(() => null),
          getDueReviewCount(userId),
          getWeakWords(userId, 5),
          sessionService.getStats(userId, 3650),
          sessionService.getStats(userId, 7),
        ])

        setWords(allWords)
        setProgress(userProgress)
        setTodayStats(today)
        if (profile) setDbStreak(profile.streak_count)
        setDueReviewCount(dueCount)
        setWeakWords(weak)

        // Rank lookup hits the network — start it in parallel with
        // achievements so we don't pile another round-trip on the critical path.
        const myLearned = userProgress.filter((p) => p.mastery_level >= 3).length
        const rankPromise = supabaseProfiles
          .getUserRank(userId, myLearned)
          .then((rankData) => {
            setRank(rankData.rank)
            setTotalUsers(rankData.total)
          })
          .catch(() => {
            setRank(null)
            setTotalUsers(0)
          })

        try {
          const totalWordsLearned = myLearned
          const currentStreak = user?.streak_count || 0
          const totalSessions = allSessions.length
          const perfectQuizzes = allSessions.filter((s) => s.accuracy === 100).length
          const levelsStudied = ([1, 2, 3, 4] as HSKLevel[]).filter((level) =>
            userProgress.some(
              (p) => p.mastery_level >= 1 && allWords.some((w) => w.id === p.word_id && w.hsk_level === level)
            )
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

        // AI digest is purely additive and slow — start it in the background
        // so it never blocks the first paint of the dashboard. But only
        // generate if the user has opted in (ai_digest_enabled === 'true')
        // to avoid burning LLM tokens for everyone.
        const level = Number(localStorage.getItem('hsk_level')) || 1
        const digestStats = {
          wordsStudied: recentSessions.reduce((sum, s) => sum + s.words_studied, 0),
          accuracy:
            recentSessions.length > 0
              ? Math.round(
                  recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length
                )
              : 0,
          duration: recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        }
        // Stash the data so we can generate on-demand if the user toggles
        // the digest on after the initial load.
        digestDataRef.current = {
          todayStats: digestStats,
          weak,
          streak: profile?.streak_count || dbStreak || 0,
          totalLearned: myLearned,
          level,
        }
        if (digestEnabled) {
          setDigestLoading(true)
          generateDailyDigest(digestStats, weak, profile?.streak_count || dbStreak || 0, myLearned, level)
            .then((d) => setDigest(d))
            .catch(() => {
              // digest is optional — fail silently
            })
            .finally(() => setDigestLoading(false))
        }

        // Wait for the rank network call before flipping the loading flag so
        // the rank block doesn't briefly show "0 users".
        await rankPromise
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

  // Derive loved words from progress + words data
  const lovedWordIds = new Set(progress.filter((p) => p.is_loved).map((p) => p.word_id))
  const lovedWords = words.filter((w) => lovedWordIds.has(w.id))

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        {/* Notification banner skeleton */}
        <div className="h-10 rounded-2xl bg-ink-100/60 dark:bg-ink-800/60" />

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-ink-200/60 dark:bg-ink-700/60" />
                <div className="h-3 w-24 rounded bg-ink-200/60 dark:bg-ink-700/60" />
              </div>
              <div className="flex items-end gap-2">
                <div className="h-7 w-12 rounded bg-ink-200/60 dark:bg-ink-700/60" />
                <div className="h-3 w-16 rounded bg-ink-200/60 dark:bg-ink-700/60 mb-1" />
              </div>
              {i < 2 && (
                <div className="mt-2 sm:mt-3 h-1 sm:h-1.5 rounded-full bg-ink-200/60 dark:bg-ink-700/60" />
              )}
            </div>
          ))}
        </div>

        {/* AI Digest card skeleton */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-ink-200/60 dark:bg-ink-700/60" />
            <div className="h-4 w-32 rounded bg-ink-200/60 dark:bg-ink-700/60" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-ink-200/60 dark:bg-ink-700/60" />
            <div className="h-3 w-5/6 rounded bg-ink-200/60 dark:bg-ink-700/60" />
            <div className="h-3 w-4/6 rounded bg-ink-200/60 dark:bg-ink-700/60" />
          </div>
        </div>

        {/* Content cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="card p-4">
              <div className="h-4 w-28 rounded bg-ink-200/60 dark:bg-ink-700/60 mb-3" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-ink-200/60 dark:bg-ink-700/60" />
                <div className="h-3 w-3/4 rounded bg-ink-200/60 dark:bg-ink-700/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <SEO {...PAGE_SEO.dashboard} />
      {/* Notification banners — compact pill style */}
      <div className="space-y-2">
        {(!user || user.id === 'guest') && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs sm:text-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(236,72,153,0.08) 100%)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300">
              <span className="font-semibold">Guest Mode</span> — progress saved locally.{' '}
              <Link to="/auth?redirect=/" className="underline font-medium">Sign up free</Link> to sync.
            </span>
          </motion.div>
        )}
        {goalMet && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs sm:text-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(52,211,153,0.08) 100%)',
              border: '1px solid rgba(16,185,129,0.15)',
            }}
          >
            <span className="text-base">🎉</span>
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">
              Daily goal reached! {todayStats.wordsStudied} words studied today.
            </span>
          </motion.div>
        )}
        {newAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-2xl text-xs sm:text-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(249,115,22,0.08) 100%)',
              border: '1px solid rgba(245,158,11,0.15)',
            }}
          >
            <span className="text-base">🏅</span>
            <span className="text-amber-700 dark:text-amber-300 font-semibold">
              {newAchievements.length === 1 ? 'New Achievement!' : `${newAchievements.length} New Achievements!`}
            </span>
            <div className="flex flex-wrap gap-1.5 ml-1">
              {newAchievements.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-amber-100/60 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-700/30 text-amber-800 dark:text-amber-200">
                  {a.icon} {a.name}
                </span>
              ))}
            </div>
            <button onClick={() => setNewAchievements([])} className="ml-auto text-amber-600 dark:text-amber-400 text-xs font-medium flex-shrink-0">
              Dismiss
            </button>
          </motion.div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
            className="card card-hover p-3 sm:p-4"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${stat.colors[0]} 0%, ${stat.colors[1]} 100%)`,
                  boxShadow: `0 4px 15px ${stat.shadow}`,
                }}
              >
                <stat.icon className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] text-white" />
              </div>
              <h3 className="text-xs sm:text-sm font-medium text-ink-500 dark:text-ink-400">{stat.label}</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white tabular-nums">{stat.value}</span>
              <span className="text-xs sm:text-sm text-ink-400 dark:text-ink-500 mb-1">{stat.unit}</span>
            </div>
            {i < 2 && (
              <div className="mt-2 sm:mt-3 h-1 sm:h-1.5 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
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
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm font-medium gradient-text">{stat.sub}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* AI Daily Digest — opt-in. Positioned high on the page so users
          who enable it see it immediately. When disabled, shows a compact
          "Turn on" card so we never burn LLM tokens without consent. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-ink-900 dark:text-white">AI Daily Digest</h2>
          </div>
          <div className="flex items-center gap-2">
            {digestLoading && <Loader2 className="w-4 h-4 text-red-500 animate-spin" />}
            <button
              onClick={toggleDigest}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{
                background: digestEnabled ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)',
                color: digestEnabled ? '#dc2626' : '#7c3aed',
              }}
            >
              <Power className="w-3 h-3" />
              {digestEnabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        </div>
        {digestEnabled ? (
          digest ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed">{digest.summary}</p>
              {digest.strengths.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {digest.strengths.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30 text-emerald-700 dark:text-emerald-300">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {digest.weaknesses.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {digest.weaknesses.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 text-amber-700 dark:text-amber-300">
                      {w}
                    </span>
                  ))}
                </div>
              )}
              {digest.focusAreas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">Focus Areas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {digest.focusAreas.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/30 text-red-700 dark:text-red-300">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-sm font-medium text-red-600 dark:text-red-400 italic">{digest.motivationalMessage}</p>
            </div>
          ) : digestLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink-400 dark:text-ink-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating your personalized digest...
            </div>
          ) : (
            <p className="text-sm text-ink-400 dark:text-ink-500">Start studying to get your AI-powered daily digest!</p>
          )
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-ink-400 dark:text-ink-500 flex-1">
              Turn on AI Daily Digest for personalized study insights, strengths, and focus areas.
            </p>
            <button
              onClick={toggleDigest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
              }}
            >
              <Power className="w-3.5 h-3.5" />
              Turn on
            </button>
          </div>
        )}
      </motion.div>

      {/* Review + Study Plan — side by side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {dueReviewCount > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Link
              to="/mode/flashcard"
              className="card card-hover flex items-center gap-3 p-3 sm:p-4 h-full"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.05) 100%)',
                border: '1px solid rgba(139,92,246,0.15)',
              }}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
                }}
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-ink-900 dark:text-white">{dueReviewCount} words due</h3>
                <p className="text-xs text-ink-500 dark:text-ink-400 hidden sm:block">Start flashcard review to keep your streak</p>
              </div>
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex-shrink-0">Review →</span>
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="card flex items-center justify-center p-4 text-sm text-ink-400 dark:text-ink-500"
          >
            <span className="text-base mr-2">✅</span> All caught up! No reviews due.
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: dueReviewCount > 0 ? 0.14 : 0.12 }}
        >
          <Link to="/plan" className="card card-hover flex items-center gap-3 p-3 sm:p-4 h-full"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.05) 50%, rgba(245,158,11,0.04) 100%)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
              }}
            >
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Your Study Plan</h3>
              <p className="text-xs text-ink-500 dark:text-ink-400 hidden sm:block">Personalized path with daily goals</p>
            </div>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex-shrink-0">View →</span>
          </Link>
        </motion.div>
      </div>

      {/* Rank */}
      {rank !== null && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card flex items-center gap-4 p-3 sm:p-4"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
              boxShadow: '0 4px 15px rgba(245,158,11,0.3)',
            }}
          >
            <Trophy className="w-[18px] h-[18px] text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white tabular-nums">#{rank}</span>
            <span className="text-xs sm:text-sm text-ink-400 dark:text-ink-500">of {totalUsers} learners</span>
          </div>
          <div className="flex-1 hidden sm:block">
            <div className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #fbbf24 0%, #f97316 100%)' }}
                initial={{ width: 0 }}
                animate={{ width: `${totalUsers > 0 ? Math.max(((totalUsers - rank + 1) / totalUsers) * 100, 5) : 0}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
          <span className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 flex-shrink-0">
            {rank === 1 ? 'Top 1!' : rank <= 3 ? 'Top 3!' : `Top ${Math.round((rank / totalUsers) * 100)}%`}
          </span>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">Level Progress</h2>
          <div className="h-48 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelData} layout="vertical" barSize={22} barGap={4}>
                <XAxis type="number" domain={[0, 'dataMax']} hide />
                <YAxis type="category" dataKey="level" width={44} tick={{ fontSize: 12, fill: '#787a8b' }} axisLine={false} tickLine={false} />
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
          <div className="grid grid-cols-4 gap-2 mt-2">
            {levelData.map((l) => (
              <div key={l.level} className="text-center">
                <div className="text-base sm:text-lg font-bold text-ink-900 dark:text-white">{l.learned}</div>
                <div className="text-[10px] sm:text-xs text-ink-400 dark:text-ink-500">{l.level}</div>
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
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">Mastery</h2>
          {masteryData.length === 0 ? (
            <div className="h-48 sm:h-60 flex items-center justify-center text-ink-400 text-sm">
              Start learning to see mastery data
            </div>
          ) : (
            <div className="h-48 sm:h-60 flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={masteryData} cx="50%" cy="50%" innerRadius={42} outerRadius={64} paddingAngle={3} dataKey="value">
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
              <div className="space-y-2 flex-1">
                {masteryData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 flex-1">{item.name}</span>
                    <span className="text-xs sm:text-sm font-semibold text-ink-900 dark:text-white">{item.value}</span>
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Weak Words</h2>
            </div>
            <Link to="/mode/flashcard" className="text-xs font-semibold text-red-600 dark:text-red-400">
              Practice →
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {weakWords.map((w) => (
              <Link
                key={w.id}
                to="/mode/flashcard"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-ink-700 dark:text-ink-300 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              >
                <span className="font-bold chinese-text">{w.chinese}</span>
                <span className="text-[10px] text-ink-400">{w.pinyin}</span>
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
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">Quick Start</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { to: '/mode/flashcard', icon: Layers, label: 'Flashcards', colors: ['#8b5cf6', '#7c3aed'], shadow: 'rgba(139,92,246,0.3)' },
            { to: '/mode/listening', icon: Headphones, label: 'Listening', colors: ['#34d399', '#14b8a6'], shadow: 'rgba(16,185,129,0.3)' },
            { to: '/mode/story', icon: BookOpen, label: 'AI Story', colors: ['#8b5cf6', '#ec4899'], shadow: 'rgba(139,92,246,0.3)' },
            { to: '/mode/conversation', icon: MessageSquare, label: 'AI Chat', colors: ['#3b82f6', '#818cf8'], shadow: 'rgba(99,102,241,0.3)' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card-glass card-hover flex flex-col items-center gap-2 p-3 sm:p-4 group"
            >
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${item.colors[0]} 0%, ${item.colors[1]} 100%)`,
                  boxShadow: `0 4px 12px ${item.shadow}`,
                }}
              >
                <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </motion.div>
              <span className="text-xs sm:text-sm font-semibold text-ink-700 dark:text-ink-300 group-hover:text-ink-900 dark:group-hover:text-white transition-colors">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Favorites */}
      {lovedWords.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Favorites</h2>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                {lovedWords.length}
              </span>
            </div>
            <Link
              to="/mode/flashcard"
              className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              Study all →
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lovedWords.slice(0, 16).map((w) => (
              <Link
                key={w.id}
                to="/mode/flashcard"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-ink-700 dark:text-ink-300 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              >
                <span className="font-bold chinese-text">{w.chinese}</span>
                <span className="text-[10px] text-ink-400">{w.pinyin}</span>
              </Link>
            ))}
            {lovedWords.length > 16 && (
              <span className="text-xs text-ink-400 dark:text-ink-500 self-center px-2">
                +{lovedWords.length - 16} more
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      )}
    </div>
  )
}
