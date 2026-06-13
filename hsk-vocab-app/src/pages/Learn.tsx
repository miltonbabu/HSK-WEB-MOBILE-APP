import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, HSKLevel, UserProgress } from '@/types'
import { Layers, Headphones, Timer, ListOrdered, Pencil, MessageSquare, Puzzle, Languages, Mic, PenTool } from 'lucide-react'

const learningModes = [
  {
    id: 'flashcard',
    name: 'Flashcard SRS',
    description: 'Spaced repetition for long-term memory',
    icon: Layers,
    path: '/mode/flashcard',
    colors: ['#8b5cf6', '#7c3aed'],
    shadow: 'rgba(139,92,246,0.3)',
  },
  {
    id: 'listening',
    name: 'Listening Practice',
    description: 'Audio-based tone recognition',
    icon: Headphones,
    path: '/mode/listening',
    colors: ['#34d399', '#14b8a6'],
    shadow: 'rgba(16,185,129,0.3)',
  },
  {
    id: 'timed-quiz',
    name: 'Timed Quiz',
    description: 'Speed challenges with scoring',
    icon: Timer,
    path: '/mode/timed-quiz',
    colors: ['#fbbf24', '#f97316'],
    shadow: 'rgba(245,158,11,0.3)',
  },
  {
    id: 'sequential-quiz',
    name: 'Sequential Quiz',
    description: 'Progress through words in order',
    icon: ListOrdered,
    path: '/mode/sequential-quiz',
    colors: ['#38bdf8', '#3b82f6'],
    shadow: 'rgba(56,189,248,0.3)',
  },
  {
    id: 'visual',
    name: 'Visual Learning',
    description: 'Character decomposition & stroke order',
    icon: Pencil,
    path: '/mode/visual',
    colors: ['#f472b6', '#f43f5e'],
    shadow: 'rgba(236,72,153,0.3)',
  },
  {
    id: 'sentence-making',
    name: 'Sentence Making',
    description: 'Build sentences with target vocabulary',
    icon: MessageSquare,
    path: '/mode/sentence-making',
    colors: ['#818cf8', '#3b82f6'],
    shadow: 'rgba(99,102,241,0.3)',
  },
  {
    id: 'sentence-puzzle',
    name: 'Sentence Puzzle',
    description: 'Drag-and-drop word ordering',
    icon: Puzzle,
    path: '/mode/sentence-puzzle',
    colors: ['#22d3bb', '#14b8a6'],
    shadow: 'rgba(20,184,166,0.3)',
  },
  {
    id: 'translation',
    name: 'Translation',
    description: 'Translate between Chinese and English',
    icon: Languages,
    path: '/mode/translation',
    colors: ['#a78bfa', '#7c3aed'],
    shadow: 'rgba(167,139,250,0.3)',
  },
  {
    id: 'handwriting',
    name: 'Handwriting',
    description: 'Practice writing Chinese characters by hand',
    icon: PenTool,
    path: '/mode/handwriting',
    colors: ['#ec4899', '#db2777'],
    shadow: 'rgba(236,72,153,0.3)',
  },
  {
    id: 'shadowing',
    name: 'Shadowing',
    description: 'Practice pronunciation by repeating aloud',
    icon: Mic,
    path: '/mode/shadowing',
    colors: ['#14b8a6', '#0d9488'],
    shadow: 'rgba(20,184,166,0.3)',
  },
]

const LEVEL_COLORS: Record<HSKLevel, { bg: string; shadow: string }> = {
  1: { bg: '#8b5cf6', shadow: 'rgba(139,92,246,0.35)' },
  2: { bg: '#10b981', shadow: 'rgba(16,185,129,0.35)' },
  3: { bg: '#f59e0b', shadow: 'rgba(245,158,11,0.35)' },
  4: { bg: '#ec4899', shadow: 'rgba(236,72,153,0.35)' },
  5: { bg: '#3b82f6', shadow: 'rgba(59,130,246,0.35)' },
  6: { bg: '#ef4444', shadow: 'rgba(239,68,68,0.35)' },
}

export default function Learn() {
  const { user } = useAuthStore()
  const { selectedLevel, setSelectedLevel } = useProgressStore()
  const [words, setWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const allWords = await wordService.getAll()
        setWords(allWords)
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        setProgress(userProgress)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  const getLevelStats = (level: HSKLevel) => {
    const total = words.filter((w) => w.hsk_level === level).length
    const learned = progress.filter(
      (p) => p.mastery_level >= 3 && words.some((w) => w.id === p.word_id && w.hsk_level === level)
    ).length
    return { total, learned }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Learning Modes</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1 text-sm">Choose a mode and start studying</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {([1, 2, 3, 4] as HSKLevel[]).map((level) => {
          const stats = getLevelStats(level)
          const isActive = selectedLevel === level
          const color = LEVEL_COLORS[level]
          return (
            <motion.button
              key={level}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedLevel(level)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                isActive ? 'text-white' : 'pill-inactive'
              }`}
              style={isActive ? {
                background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}dd 100%)`,
                boxShadow: `0 4px 15px ${color.shadow}`,
              } : undefined}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-white/20' : ''
                }`}
                style={isActive ? {} : { backgroundColor: color.bg, color: 'white' }}
              >
                {level}
              </span>
              HSK {level}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20' : 'bg-ink-100/50 dark:bg-ink-700/50 backdrop-blur'
              }`}>
                {stats.learned}/{stats.total}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div>
        <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">
          Study Modes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {learningModes.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={mode.path}
                className="card card-hover group flex items-start gap-4 block"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 8 }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${mode.colors[0]} 0%, ${mode.colors[1]} 100%)`,
                    boxShadow: `0 4px 15px ${mode.shadow}`,
                  }}
                >
                  <mode.icon className="w-5 h-5 text-white" />
                </motion.div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-900 dark:text-white text-sm">{mode.name}</h3>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 leading-relaxed">{mode.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}