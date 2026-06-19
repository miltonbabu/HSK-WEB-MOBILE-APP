import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuthStore, useProgressStore } from '@/stores'
import { HSKLevel } from '@/types'
import { ExamLength, ExamSection, ExamSectionId, ExamResult, GenerateProgress } from '@/types/exam'
import {
  gradeExam,
  createExamSession,
  generateNextSection,
  ExamSession,
} from '@/services/exam.service'
import { recordStudySession } from '@/utils/study-helpers'
import SEO from '@/components/SEO/Helmet'
import { PAGE_SEO } from '@/utils/seo'
import ExamSetup from '@/components/exam/ExamSetup'
import ExamSectionRunner from '@/components/exam/ExamSectionRunner'
import ExamResultView from '@/components/exam/ExamResult'
import SectionTransition from '@/components/exam/SectionTransition'
import { wordService } from '@/services/sqlite-api'

type Phase = 'setup' | 'section' | 'transition' | 'result'

export default function ExamMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()

  const [phase, setPhase] = useState<Phase>('setup')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupProgress, setSetupProgress] = useState<GenerateProgress | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  // The streaming exam session
  const sessionRef = useRef<ExamSession | null>(null)
  const [sections, setSections] = useState<ExamSection[]>([])
  const [sectionIndex, setSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [result, setResult] = useState<ExamResult | null>(null)
  const [transitionProgress, setTransitionProgress] = useState<GenerateProgress | null>(null)
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const [pendingNextSectionId, setPendingNextSectionId] = useState<ExamSectionId | null>(null)

  const sectionStartRef = useRef<number>(Date.now())
  const sectionTimesRef = useRef<Record<ExamSectionId, number>>({
    listening: 0,
    reading: 0,
    writing: 0,
  })
  const abortRef = useRef<AbortController | null>(null)

  // ── Exam start: only generate the listening section upfront ────
  const handleStart = useCallback(async (length: ExamLength, level: HSKLevel) => {
    setSetupLoading(true)
    setSetupError(null)
    setSetupProgress({ step: 'questions', done: 0, total: 0, message: 'Loading vocabulary…' })

    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    try {
      const words = await wordService.getByLevel(level)
      if (words.length === 0) throw new Error(`No words found for HSK level ${level}`)

      const session = createExamSession(length, level, words, signal)
      sessionRef.current = session

      setSetupProgress({ step: 'questions', done: 0, total: 1, message: 'Generating listening section…' })
      const first = await generateNextSection(session, (p) => setSetupProgress(p))
      if (!first) throw new Error('Failed to generate first section')

      setSections([first])
      setSectionIndex(0)
      setAnswers(new Map())
      sectionTimesRef.current = { listening: 0, reading: 0, writing: 0 }
      sectionStartRef.current = Date.now()
      setPhase('section')

      // Kick off background generation of the next section so it's ready
      // by the time the user finishes this one.
      void prefetchNextInBackground(session)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('[Exam] start failed:', err)
      setSetupError(err?.message || 'Failed to start exam. Please try again.')
    } finally {
      setSetupLoading(false)
      setSetupProgress(null)
    }
  }, [])

  /**
   * Background-generate the next section in the session. Errors are
   * surfaced only when the user actually tries to advance to that section.
   */
  const prefetchNextInBackground = useCallback(async (session: ExamSession) => {
    if (session.nextSectionToGenerate === null) return
    if (session.isPreparing) return
    try {
      await generateNextSection(session)
      // Force a re-render so the section list shows the new section
      setSections([...session.sections])
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return
      console.warn('[Exam] background section prep failed:', err)
      // Don't surface this until the user clicks "next"
    }
  }, [])

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, answer)
      return next
    })
  }, [])

  // ── Section finish → either transition to next section or results
  const handleFinishSection = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return

    // Record time spent on the section that just ended.
    const currentSection = sections[sectionIndex]
    if (currentSection) {
      const elapsed = Math.round((Date.now() - sectionStartRef.current) / 1000)
      sectionTimesRef.current[currentSection.id] = elapsed
    }

    // Try to find the next section in the already-generated list
    const nextIdx = sectionIndex + 1
    if (nextIdx < sections.length) {
      // Already prepared — go straight to it
      setSectionIndex(nextIdx)
      sectionStartRef.current = Date.now()
      // Continue prefetching in background
      void prefetchNextInBackground(session)
      return
    }

    // Next section is not yet generated — show transition UI
    if (session.nextSectionToGenerate === null) {
      // All sections done — grade and show results
      const finalResult = gradeExam(sections, answers, sectionTimesRef.current)
      setResult(finalResult)
      setPhase('result')

      const userId = user?.id || 'guest'
      const accuracy = Math.round((finalResult.correctCount / Math.max(finalResult.totalQuestions, 1)) * 100)
      recordStudySession(userId, 'exam', finalResult.totalQuestions, accuracy, finalResult.durationSec)
      return
    }

    // Next section is queued but not ready — enter transition phase
    setPendingNextSectionId(session.nextSectionToGenerate)
    setTransitionProgress({ step: 'questions', done: 0, total: 1, message: 'Loading next section…' })
    setTransitionError(null)
    setPhase('transition')
  }, [sections, sectionIndex, answers, user?.id, prefetchNextInBackground])

  // Watch the session while in transition phase — when the new section
  // becomes available, advance to it automatically.
  useEffect(() => {
    if (phase !== 'transition') return
    const session = sessionRef.current
    if (!session) return

    const id = setInterval(() => {
      if (session.isPreparing) return
      const newSections = session.sections
      if (newSections.length > sectionIndex + 1) {
        setSections([...newSections])
        setSectionIndex(sectionIndex + 1)
        sectionStartRef.current = Date.now()
        setTransitionProgress(null)
        setTransitionError(null)
        setPhase('section')
        // Continue prefetching the rest in background
        void prefetchNextInBackground(session)
        clearInterval(id)
      } else if (session.nextSectionToGenerate === null && !session.isPreparing) {
        // All sections done — go to results
        const finalResult = gradeExam(newSections, answers, sectionTimesRef.current)
        setResult(finalResult)
        setPhase('result')

        const userId = user?.id || 'guest'
        const accuracy = Math.round((finalResult.correctCount / Math.max(finalResult.totalQuestions, 1)) * 100)
        recordStudySession(userId, 'exam', finalResult.totalQuestions, accuracy, finalResult.durationSec)
        clearInterval(id)
      }
    }, 250)

    return () => clearInterval(id)
  }, [phase, sectionIndex, answers, user?.id, prefetchNextInBackground])

  // Show transition error in the same panel
  useEffect(() => {
    if (phase !== 'transition') return
    const session = sessionRef.current
    if (!session) return

    // Try to generate the next section in the foreground too (background
    // attempt may have failed).
    if (!session.isPreparing && session.nextSectionToGenerate && !session.sections[sectionIndex + 1]) {
      generateNextSection(session, (p) => setTransitionProgress(p))
        .then((newSection) => {
          if (newSection) {
            setSections([...session.sections])
            setSectionIndex(sectionIndex + 1)
            sectionStartRef.current = Date.now()
            setTransitionProgress(null)
            setTransitionError(null)
            setPhase('section')
            void prefetchNextInBackground(session)
          }
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setTransitionError(err?.message || 'Failed to load next section.')
        })
    }
  }, [phase, sectionIndex, prefetchNextInBackground])

  const handleRetake = useCallback(() => {
    abortRef.current?.abort()
    sessionRef.current = null
    setResult(null)
    setSections([])
    setAnswers(new Map())
    setSectionIndex(0)
    setPhase('setup')
  }, [])

  // ── Render ─────────────────────────────────────────────────────

  if (setupError) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white mt-3">Exam failed to load</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-2">{setupError}</p>
        <button onClick={handleRetake} className="btn-primary mt-4">Try again</button>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <>
        <SEO {...PAGE_SEO.exam} />
        <ExamSetup
          selectedLevel={selectedLevel}
          onStart={handleStart}
          loading={setupLoading}
          progress={setupProgress}
        />
      </>
    )
  }

  if (phase === 'transition' && pendingNextSectionId) {
    return (
      <>
        <SEO {...PAGE_SEO.exam} />
        <SectionTransition
          nextSectionId={pendingNextSectionId}
          progress={transitionProgress}
          error={transitionError}
          onRetake={handleRetake}
        />
      </>
    )
  }

  if (phase === 'section' && sections.length > 0 && sections[sectionIndex]) {
    const section = sections[sectionIndex]
    return (
      <>
        <SEO {...PAGE_SEO.exam} />
        <ExamSectionRunner
          section={section}
          sectionIndex={sectionIndex}
          totalSections={3}
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

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent" />
    </div>
  )
}
