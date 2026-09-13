'use client'

import { useCallback, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useAuthStore, useProgressStore } from '@/stores'
import { HSKLevel } from '@/types'
import { ExamSection, ExamSectionId, ExamResult, GenerateProgress } from '@/types/exam'
import { Skill } from '@/types/learning'
import { generateSection, gradeExam } from '@/services/exam.service'
import { recordStudySession } from '@/utils/study-helpers'
import { recordMistake } from '@/services/mistakes.service'
import ExamSectionRunner from '@/components/exam/ExamSectionRunner'

type Phase = 'setup' | 'section' | 'result'

interface Props {
  kind: 'reading' | 'writing'
}

const META: Record<'reading' | 'writing', { title: string; skill: Skill }> = {
  reading: { title: 'Reading Practice', skill: 'reading' },
  writing: { title: 'Writing Practice', skill: 'writing' },
}

export default function PracticeSection({ kind }: Props) {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const userId = user?.id || 'guest'

  const [phase, setPhase] = useState<Phase>('setup')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<GenerateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [section, setSection] = useState<ExamSection | null>(null)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [result, setResult] = useState<ExamResult | null>(null)

  const startRef = useRef<number>(Date.now())
  const abortRef = useRef<AbortController | null>(null)

  const handleStart = useCallback(
    async (level: HSKLevel) => {
      setLoading(true)
      setError(null)
      setProgress({ step: 'questions', done: 0, total: 1, message: 'Loading vocabulary…' })
      abortRef.current = new AbortController()
      const signal = abortRef.current.signal
      try {
        const sec = await generateSection(kind, 'practice', level, signal, (p) => setProgress(p))
        if (sec.questions.length === 0) {
          throw new Error('No questions could be generated. Try again.')
        }
        setSection(sec)
        setAnswers(new Map())
        setResult(null)
        startRef.current = Date.now()
        setPhase('section')
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err?.message || 'Failed to start practice.')
      } finally {
        setLoading(false)
        setProgress(null)
      }
    },
    [kind],
  )

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, answer)
      return next
    })
  }, [])

  const handleFinish = useCallback(async () => {
    if (!section) return
    const elapsed = Math.round((Date.now() - startRef.current) / 1000)
    const times: Record<ExamSectionId, number> = { listening: 0, reading: 0, writing: 0 }
    times[section.id] = elapsed

    const res = gradeExam([section], answers, times)
    setResult(res)
    setPhase('result')

    // Persist mistakes for every wrong answer.
    const skill = META[kind].skill
    for (const review of res.questionReviews) {
      if (review.correct) continue
      await recordMistake({
        user_id: userId,
        question_id: null,
        word_id: review.question.word.id,
        skill,
        prompt: review.question.prompt || review.question.word.chinese,
        user_answer: review.userAnswer,
        correct_answer: review.question.correctAnswer,
        explanation: '',
      })
    }

    const accuracy = Math.round((res.correctCount / Math.max(res.totalQuestions, 1)) * 100)
    recordStudySession(userId, kind, res.totalQuestions, accuracy, res.durationSec)
  }, [section, answers, userId, kind])

  const handleRetake = useCallback(() => {
    abortRef.current?.abort()
    setSection(null)
    setResult(null)
    setAnswers(new Map())
    setError(null)
    setPhase('setup')
  }, [])

  const meta = META[kind]

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white mt-3">Practice failed to load</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-2">{error}</p>
        <button onClick={handleRetake} className="btn-primary mt-4">Try again</button>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <div className="max-w-md mx-auto pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">{meta.title}</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Pick a level to practice {kind}.</p>

        <div className="grid grid-cols-4 gap-2 mt-5">
          {([1, 2, 3, 4] as HSKLevel[]).map((lvl) => (
            <button
              key={lvl}
              disabled={loading}
              onClick={() => handleStart(lvl)}
              className={`py-6 rounded-2xl text-2xl font-extrabold transition-all disabled:opacity-50 ${
                selectedLevel === lvl
                  ? 'text-white'
                  : 'bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-red-300'
              }`}
              style={selectedLevel === lvl ? { background: 'linear-gradient(135deg,#8b5cf6,#ec4899)' } : undefined}
            >
              {lvl}
            </button>
          ))}
        </div>
        {loading && progress && (
          <p className="mt-4 text-center text-xs text-ink-500 dark:text-ink-400">{progress.message}</p>
        )}
      </div>
    )
  }

  if (phase === 'section' && section) {
    return (
      <ExamSectionRunner
        key={section.id}
        section={section}
        sectionIndex={0}
        totalSections={1}
        answers={answers}
        onAnswer={handleAnswer}
        onFinishSection={handleFinish}
        allowPause
      />
    )
  }

  if (phase === 'result' && result) {
    const pct = Math.round((result.correctCount / Math.max(result.totalQuestions, 1)) * 100)
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="card p-6 text-center">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white">{meta.title} — Results</h2>
          <p className="mt-1 text-3xl font-extrabold text-red-500">
            {result.correctCount}/{result.totalQuestions}
            <span className="text-lg text-ink-400"> ({pct}%)</span>
          </p>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
            Wrong answers were saved to your Mistake Notebook.
          </p>
        </div>

        <div className="card p-4 space-y-2">
          {result.questionReviews.map((review, i) => (
            <div key={review.question.id} className="flex items-start gap-3 py-1 border-b border-ink-100 dark:border-ink-700 last:border-0">
              <span className={`text-sm font-bold ${review.correct ? 'text-green-600' : 'text-red-500'}`}>{review.correct ? '✓' : '✕'}</span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-ink-700 dark:text-ink-200 truncate">{review.question.prompt}</p>
                <p className="text-green-700 dark:text-green-400 text-xs">Correct: {review.question.correctAnswer}</p>
              </div>
              <span className="text-xs text-ink-400 shrink-0">Q{i + 1}</span>
            </div>
          ))}
        </div>

        <button onClick={handleRetake} className="btn-primary w-full flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Practice again
        </button>
      </div>
    )
  }

  return null
}