import { useState, useRef, useCallback } from 'react'
import { useAuthStore, useProgressStore } from '@/stores'
import { HSKLevel } from '@/types'
import { ExamLength, ExamSection, ExamSectionId, ExamResult } from '@/types/exam'
import { generateExam, gradeExam } from '@/services/exam.service'
import { recordStudySession } from '@/utils/study-helpers'
import SEO from '@/components/SEO/Helmet'
import { PAGE_SEO } from '@/utils/seo'
import ExamSetup from '@/components/exam/ExamSetup'
import ExamSectionRunner from '@/components/exam/ExamSectionRunner'
import ExamResultView from '@/components/exam/ExamResult'

type Phase = 'setup' | 'section' | 'result'

export default function ExamMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()

  const [phase, setPhase] = useState<Phase>('setup')
  const [loading, setLoading] = useState(false)
  const [sections, setSections] = useState<ExamSection[]>([])
  const [sectionIndex, setSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [result, setResult] = useState<ExamResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sectionStartRef = useRef<number>(Date.now())
  const sectionTimesRef = useRef<Record<ExamSectionId, number>>({
    listening: 0,
    reading: 0,
    writing: 0,
  })
  const abortRef = useRef<AbortController | null>(null)

  const handleStart = useCallback(async (length: ExamLength, level: HSKLevel) => {
    setLoading(true)
    setError(null)
    abortRef.current = new AbortController()
    try {
      const built = await generateExam(length, level, abortRef.current.signal)
      setSections(built)
      setSectionIndex(0)
      setAnswers(new Map())
      sectionTimesRef.current = { listening: 0, reading: 0, writing: 0 }
      sectionStartRef.current = Date.now()
      setPhase('section')
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('[Exam] generation failed:', err)
      setError(err?.message || 'Failed to generate exam. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, answer)
      return next
    })
  }, [])

  const handleFinishSection = useCallback(() => {
    // Record time spent on the section that just ended.
    const currentSection = sections[sectionIndex]
    if (currentSection) {
      const elapsed = Math.round((Date.now() - sectionStartRef.current) / 1000)
      sectionTimesRef.current[currentSection.id] = elapsed
    }

    if (sectionIndex < sections.length - 1) {
      // Move to next section
      setSectionIndex((i) => i + 1)
      sectionStartRef.current = Date.now()
    } else {
      // All sections done — grade the exam
      const finalAnswers = answers
      const finalResult = gradeExam(sections, finalAnswers, sectionTimesRef.current)
      setResult(finalResult)
      setPhase('result')

      // Record study session + leaderboard
      const userId = user?.id || 'guest'
      const accuracy = Math.round((finalResult.correctCount / Math.max(finalResult.totalQuestions, 1)) * 100)
      recordStudySession(userId, 'exam', finalResult.totalQuestions, accuracy, finalResult.durationSec)
    }
  }, [sections, sectionIndex, answers, user?.id])

  const handleRetake = useCallback(() => {
    setResult(null)
    setSections([])
    setAnswers(new Map())
    setSectionIndex(0)
    setPhase('setup')
  }, [])

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white mt-3">Exam failed to load</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-2">{error}</p>
        <button onClick={handleRetake} className="btn-primary mt-4">Try again</button>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <>
        <SEO {...PAGE_SEO.exam} />
        <ExamSetup selectedLevel={selectedLevel} onStart={handleStart} loading={loading} />
      </>
    )
  }

  if (phase === 'section' && sections.length > 0) {
    const section = sections[sectionIndex]
    return (
      <>
        <SEO {...PAGE_SEO.exam} />
        <ExamSectionRunner
          section={section}
          sectionIndex={sectionIndex}
          totalSections={sections.length}
          answers={answers}
          onAnswer={handleAnswer}
          onFinishSection={handleFinishSection}
        />
      </>
    )
  }

  if (phase === 'result' && result) {
    return (
      <>
        <SEO {...PAGE_SEO.exam} />
        <ExamResultView result={result} onRetake={handleRetake} />
      </>
    )
  }

  // Fallback (shouldn't happen)
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent" />
    </div>
  )
}
