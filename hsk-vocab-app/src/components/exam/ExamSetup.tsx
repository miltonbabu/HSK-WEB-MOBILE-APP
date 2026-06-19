import { useState } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, Clock, ListChecks, ArrowRight } from 'lucide-react'
import { ExamLength } from '@/types/exam'
import type { GenerateProgress } from '@/services/exam.service'
import { HSKLevel } from '@/types'

interface Props {
  selectedLevel: HSKLevel
  onStart: (length: ExamLength, level: HSKLevel) => void
  loading: boolean
  progress?: GenerateProgress | null
}

const EXAM_OPTIONS: {
  id: ExamLength
  name: string
  desc: string
  questions: number
  duration: string
  icon: typeof Clock
  colors: string[]
}[] = [
  {
    id: 'practice',
    name: 'Practice Exam',
    desc: 'Quick 30-question mock exam. Same 3 sections, shorter.',
    questions: 30,
    duration: '~25 min',
    icon: ListChecks,
    colors: ['#3b82f6', '#2563eb'],
  },
  {
    id: 'full',
    name: 'Full Mock Exam',
    desc: 'Complete 100-question HSK 4 exam. Listening, reading, writing.',
    questions: 100,
    duration: '~95 min',
    icon: GraduationCap,
    colors: ['#ef4444', '#dc2626'],
  },
]

export default function ExamSetup({ selectedLevel, onStart, loading, progress }: Props) {
  const [length, setLength] = useState<ExamLength>('practice')
  const [level, setLevel] = useState<HSKLevel>(selectedLevel || 4)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white">HSK 4 Mock Exam</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1 text-sm">
          Full mock exam with listening, reading, and writing sections — just like the real HSK 4 test.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">1. Choose exam length</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXAM_OPTIONS.map((opt) => {
            const active = length === opt.id
            return (
              <motion.button
                key={opt.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setLength(opt.id)}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800'
                }`}
                style={active ? { background: `linear-gradient(135deg, ${opt.colors[0]} 0%, ${opt.colors[1]} 100%)` } : undefined}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: active ? 'rgba(255,255,255,0.2)' : `linear-gradient(135deg, ${opt.colors[0]} 0%, ${opt.colors[1]} 100%)`,
                    }}
                  >
                    <opt.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-sm ${active ? 'text-white' : 'text-ink-900 dark:text-white'}`}>
                      {opt.name}
                    </h3>
                    <p className={`text-xs mt-0.5 ${active ? 'text-white/80' : 'text-ink-500 dark:text-ink-400'}`}>
                      {opt.desc}
                    </p>
                    <div className={`flex gap-3 mt-2 text-[11px] font-medium ${active ? 'text-white/90' : 'text-ink-600 dark:text-ink-300'}`}>
                      <span>{opt.questions} questions</span>
                      <span>{opt.duration}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">2. Choose HSK level</h2>
        <div className="flex gap-2 flex-wrap">
          {([1, 2, 3, 4] as HSKLevel[]).map((lvl) => {
            const active = level === lvl
            return (
              <button
                key={lvl}
                onClick={() => setLevel(lvl)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                  active
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-300 border border-ink-200 dark:border-ink-700'
                }`}
              >
                HSK {lvl}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-2">
          The exam is designed for HSK 4. Lower levels work but questions will be easier.
        </p>
      </div>

      <div className="card p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">Exam structure</h3>
        <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <li><strong>听力 Listening:</strong> True/false, dialogue & passage comprehension (audio plays automatically)</li>
          <li><strong>阅读 Reading:</strong> Fill-in-the-blank, sentence matching, passage comprehension</li>
          <li><strong>书写 Writing:</strong> Sentence reordering & picture description</li>
          <li><strong>Passing score:</strong> 180/300 (60%). Each question = 3 points.</li>
        </ul>
      </div>

      <button
        onClick={() => onStart(length, level)}
        disabled={loading}
        className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Preparing your exam...
          </>
        ) : (
          <>
            Start Exam <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

      {loading && progress && (
        <div className="card p-4 space-y-2 border-2 border-ink-200 dark:border-ink-700">
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
            {progress.message}
          </p>
          <div className="h-2 rounded-full bg-ink-200 dark:bg-ink-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-300"
              style={{
                width:
                  progress.total > 0
                    ? `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%`
                    : progress.step === 'questions'
                    ? `${Math.min(99, (progress.done / 3) * 100)}%`
                    : '5%',
              }}
            />
          </div>
          <p className="text-[11px] text-ink-500 dark:text-ink-400">
            This one-time prep lets the exam run smoothly without delays. Audio, images, and questions are all loaded up front.
          </p>
        </div>
      )}
    </div>
  )
}
