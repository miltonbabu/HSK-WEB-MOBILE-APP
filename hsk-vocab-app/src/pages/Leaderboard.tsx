import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { leaderboardService } from '@/services/sqlite-api'
import { LeaderboardEntry, LearningMode } from '@/types'
import { Trophy, Info } from 'lucide-react'

const modes: { id: LearningMode; label: string; colors: string[]; shadow: string }[] = [
  { id: 'timed-quiz', label: 'Timed Quiz', colors: ['#fbbf24', '#f97316'], shadow: 'rgba(245,158,11,0.35)' },
  { id: 'flashcard', label: 'Flashcards', colors: ['#8b5cf6', '#7c3aed'], shadow: 'rgba(139,92,246,0.35)' },
  { id: 'listening', label: 'Listening', colors: ['#34d399', '#14b8a6'], shadow: 'rgba(16,185,129,0.35)' },
  { id: 'sequential-quiz', label: 'Sequential Quiz', colors: ['#38bdf8', '#3b82f6'], shadow: 'rgba(56,189,248,0.35)' },
]

const medalStyles = [
  { bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', border: 'border-amber-400', shadow: '0 4px 15px rgba(245,158,11,0.4)' },
  { bg: 'linear-gradient(135deg, #c0c0c0 0%, #9ca3af 100%)', border: 'border-gray-300', shadow: '0 4px 15px rgba(156,163,175,0.3)' },
  { bg: 'linear-gradient(135deg, #cd853f 0%, #d97706 100%)', border: 'border-orange-400', shadow: '0 4px 15px rgba(217,119,6,0.3)' },
]

export default function Leaderboard() {
  const [selectedMode, setSelectedMode] = useState<LearningMode>('timed-quiz')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLeaderboard() {
      setLoading(true)
      try {
        const data = await leaderboardService.getTop(selectedMode, 20)
        setEntries(data)
      } catch (error) {
        console.error('Failed to load leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }
    loadLeaderboard()
  }, [selectedMode])

  const activeMode = modes.find(m => m.id === selectedMode)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Leaderboard</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">See how you rank against other learners</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {modes.map((mode) => {
          const isActive = selectedMode === mode.id
          return (
            <motion.button
              key={mode.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedMode(mode.id)}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                isActive ? 'text-white' : 'pill-inactive'
              }`}
              style={isActive ? {
                background: `linear-gradient(135deg, ${mode.colors[0]} 0%, ${mode.colors[1]} 100%)`,
                boxShadow: `0 4px 15px ${mode.shadow}`,
              } : undefined}
            >
              {mode.label}
            </motion.button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-red-500 border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 card">
          <Trophy className="w-12 h-12 text-ink-400 dark:text-ink-600 mx-auto" />
          <h2 className="text-xl font-semibold text-ink-900 dark:text-white mt-4">No Entries Yet</h2>
          <p className="text-ink-500 dark:text-ink-400 mt-2">
            Be the first to set a score in {activeMode?.label}!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 3).map((entry, index) => (
            <motion.div
              key={entry.user_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card flex items-center gap-4"
              style={{
                background: index === 0 ? 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.1) 100%)' :
                           index === 1 ? 'linear-gradient(135deg, rgba(192,192,192,0.12) 0%, rgba(156,163,175,0.08) 100%)' :
                           'linear-gradient(135deg, rgba(205,133,63,0.12) 0%, rgba(217,119,6,0.08) 100%)',
                border: `1px solid ${index === 0 ? 'rgba(251,191,36,0.3)' : index === 1 ? 'rgba(192,192,192,0.3)' : 'rgba(205,133,63,0.25)'}`,
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white"
                style={{
                  background: medalStyles[index].bg,
                  boxShadow: medalStyles[index].shadow,
                }}
              >
                {index + 1}
              </div>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', boxShadow: '0 2px 10px rgba(139,92,246,0.3)' }}
              >
                {entry.username?.[0]?.toUpperCase() || '?'}
              </motion.div>
              <div className="flex-1">
                <p className="font-semibold text-ink-900 dark:text-white">{entry.username}</p>
                <p className="text-sm text-ink-500 dark:text-ink-400">Accuracy: {Math.round(entry.accuracy)}%</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold gradient-text">{entry.score}</p>
                <p className="text-sm text-ink-500 dark:text-ink-400">points</p>
              </div>
            </motion.div>
          ))}

          {entries.slice(3).map((entry, index) => (
            <motion.div
              key={entry.user_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="card flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-500 dark:text-ink-400 font-medium"
                style={{ background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                {index + 4}
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-ink-500 dark:text-ink-400 font-medium"
                style={{ background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                {entry.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <p className="font-medium text-ink-900 dark:text-white">{entry.username}</p>
                <p className="text-sm text-ink-500 dark:text-ink-400">Accuracy: {Math.round(entry.accuracy)}%</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-ink-900 dark:text-white">{entry.score}</p>
                <p className="text-sm text-ink-500 dark:text-ink-400">pts</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card flex items-start gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(236,72,153,0.08) 100%)',
          border: '1px solid rgba(139,92,246,0.2)',
        }}
      >
        <Info className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-700 dark:text-red-300 text-sm mb-1">How to Join</h3>
          <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
            Complete quizzes and learning sessions to appear on the leaderboard.
            Higher accuracy and faster times earn more points!
          </p>
        </div>
      </motion.div>
    </div>
  )
}