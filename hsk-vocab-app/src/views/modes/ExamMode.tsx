'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useAuthStore, useProgressStore, useSettingsStore } from '@/stores'
import { HSKLevel } from '@/types'
import { ExamLength, ExamSection, ExamSectionId, ExamResult, GenerateProgress } from '@/types/exam'
import { ExamAttempt } from '@/types/learning'
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
import { wordService, examAttemptService } from '@/services/sqlite-api'

type Phase = 'setup' | 'section' | 'transition' | 'result'

/** Collect blob: URLs from a section's questions so they can be revoked later. */
function collectBlobUrls(section: ExamSection): string[] {
  const urls: string[] = []
  for (const q of section.questions) {
    if (q.imageUrl?.startsWith('blob:')) urls.push(q.imageUrl)
    if (q.imageOptions) {
      for (const o of q.imageOptions) {
        if (o.url.startsWith('blob:')) urls.push(o.url)
      }
    }
  }
  return urls
}

/** Strip blob: URLs from sections so they can be safely serialized for autosave. */
function stripBlobUrls(sections: ExamSection[]): ExamSection[] {
  return sections.map((s) => ({
    ...s,
    questions: s.questions.map((q) => ({
      ...q,
      imageUrl: q.imageUrl?.startsWith('blob:') ? undefined : q.imageUrl,
      imageOptions: q.imageOptions?.map((o) => ({
        ...o,
        url: o.url.startsWith('blob:') ? '' : o.url,
      })),
    })),
  }))
}

export default function ExamMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const { hskVersion } = useSettingsStore()

  const [phase, setPhase] = useState<Phase>('setup')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupProgress, setSetupProgress] = useState<GenerateProgress | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [resumeAttempt, setResumeAttempt] = useState<ExamAttempt | null>(null)

  // The streaming exam session
  const sessionRef = useRef<ExamSession | null>(null)
  const blobUrlsRef = useRef<Set<string>>(new Set())
  const attemptIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<string>(new Date().toISOString())
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sections, setSections] = useState<ExamSection[]>([])
  const [sectionIndex, setSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [result, setResult] = useState<ExamResult | null>(null)
  const [transitionProgress, setTransitionProgress] = useState<GenerateProgress | null>(null)
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const [pendingNextSectionId, setPendingNextSectionId] = useState<ExamSectionId | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [warningDismissed, setWarningDismissed] = useState(false)

  const sectionStartRef = useRef<number>(Date.now())
  const sectionTimesRef = useRef<Record<ExamSectionId, number>>({
    listening: 0,
    reading: 0,
    writing: 0,
  })
  const abortRef = useRef<AbortController | null>(null)

  // ── Check for an in-progress exam on mount ────
  useEffect(() => {
    const userId = user?.id || 'guest'
    examAttemptService
      .latestInProgress(userId)
      .then((attempt) => {
        if (attempt) setResumeAttempt(attempt)
      })
      .catch(() => {})
  }, [user?.id])

  // ── Debounced autosave of answers + sections ────
  const scheduleAutosave = useCallback(() => {
    if (!attemptIdRef.current) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      const userId = user?.id || 'guest'
      const attemptId = attemptIdRef.current
      if (!attemptId) return
      const answersObj: Record<string, string> = {}
      answers.forEach((v, k) => { answersObj[k] = v })
      examAttemptService
        .upsert({
          id: attemptId,
          user_id: userId,
          hsk_version: hskVersion,
          hsk_level: selectedLevel,
          config: {
            length: sessionRef.current?.length,
            level: sessionRef.current?.level,
            sectionIndex,
            sections: stripBlobUrls(sections),
          },
          status: 'in_progress',
          answers: answersObj,
          section_times: sectionTimesRef.current,
          score: null,
          section_scores: null,
          started_at: startedAtRef.current,
          submitted_at: null,
          duration_sec: 0,
        })
        .catch(() => {})
    }, 3000)
  }, [answers, sections, sectionIndex, user?.id, hskVersion, selectedLevel])

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

      // Create an autosave attempt row
      const attemptId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `exam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      attemptIdRef.current = attemptId
      startedAtRef.current = new Date().toISOString()
      const userId = user?.id || 'guest'
      const now = startedAtRef.current
      examAttemptService
        .upsert({
          id: attemptId,
          user_id: userId,
          hsk_version: hskVersion,
          hsk_level: level,
          config: { length, level, sectionIndex: 0, sections: [] },
          status: 'in_progress',
          answers: {},
          section_times: { listening: 0, reading: 0, writing: 0 },
          score: null,
          section_scores: null,
          started_at: now,
          submitted_at: null,
          duration_sec: 0,
        })
        .catch(() => {})

      setSetupProgress({ step: 'questions', done: 0, total: 1, message: 'Generating listening section…' })
      const first = await generateNextSection(session, (p) => setSetupProgress(p))
      if (!first) throw new Error('Failed to generate first section')

      // Track blob URLs for cleanup on retake (Fix 10).
      collectBlobUrls(first).forEach((u) => blobUrlsRef.current.add(u))
      // Sync warnings so the UI can show a banner (Fix 12).
      setWarnings([...session.warnings])
      setWarningDismissed(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hskVersion])

  /**
   * Background-generate the next section in the session. Errors are
   * surfaced only when the user actually tries to advance to that section.
   */
  const prefetchNextInBackground = useCallback(async (session: ExamSession) => {
    if (session.nextSectionToGenerate === null) return
    if (session.isPreparing) return
    try {
      const newSection = await generateNextSection(session)
      if (newSection) {
        // Track blob URLs for cleanup on retake (Fix 10).
        collectBlobUrls(newSection).forEach((u) => blobUrlsRef.current.add(u))
        // Sync any new warnings (Fix 12).
        if (session.warnings.length > warnings.length) {
          setWarnings([...session.warnings])
        }
      }
      // Force a re-render so the section list shows the new section
      setSections([...session.sections])
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return
      console.warn('[Exam] background section prep failed:', err)
      // Don't surface this until the user clicks "next"
    }
  }, [warnings.length])

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, answer)
      return next
    })
    scheduleAutosave()
  }, [scheduleAutosave])

  // ── Mark the autosave attempt as submitted ────
  const markAttemptSubmitted = useCallback((finalResult: ExamResult) => {
    const attemptId = attemptIdRef.current
    if (!attemptId) return
    const userId = user?.id || 'guest'
    const sectionScores: Record<string, { correct: number; total: number }> = {}
    for (const [sid, sr] of Object.entries(finalResult.sectionResults)) {
      sectionScores[sid] = { correct: sr.correct, total: sr.total }
    }
    examAttemptService
      .upsert({
        id: attemptId,
        user_id: userId,
        hsk_version: hskVersion,
        hsk_level: selectedLevel,
        config: { sections: stripBlobUrls(sections) },
        status: 'submitted',
        answers: Object.fromEntries(answers),
        section_times: sectionTimesRef.current,
        score: finalResult.score,
        section_scores: sectionScores,
        started_at: startedAtRef.current,
        submitted_at: new Date().toISOString(),
        duration_sec: finalResult.durationSec,
      })
      .catch(() => {})
  }, [user?.id, hskVersion, selectedLevel, sections, answers])

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
      scheduleAutosave()
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
      markAttemptSubmitted(finalResult)

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
  }, [sections, sectionIndex, answers, user?.id, prefetchNextInBackground, scheduleAutosave, markAttemptSubmitted])

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
        markAttemptSubmitted(finalResult)

        const userId = user?.id || 'guest'
        const accuracy = Math.round((finalResult.correctCount / Math.max(finalResult.totalQuestions, 1)) * 100)
        recordStudySession(userId, 'exam', finalResult.totalQuestions, accuracy, finalResult.durationSec)
        clearInterval(id)
      }
    }, 250)

    return () => clearInterval(id)
  }, [phase, sectionIndex, answers, user?.id, prefetchNextInBackground, markAttemptSubmitted])

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
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrlsRef.current.clear()
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    if (attemptIdRef.current) {
      examAttemptService.remove(attemptIdRef.current).catch(() => {})
      attemptIdRef.current = null
    }
    sessionRef.current = null
    setResult(null)
    setSections([])
    setAnswers(new Map())
    setSectionIndex(0)
    setWarnings([])
    setWarningDismissed(false)
    setPhase('setup')
  }, [])

  const handleResume = useCallback(() => {
    const attempt = resumeAttempt
    if (!attempt) return
    const config = attempt.config as { length?: ExamLength; level?: HSKLevel; sectionIndex?: number; sections?: ExamSection[] }
    const savedSections = config?.sections
    if (!savedSections || savedSections.length === 0) {
      examAttemptService.remove(attempt.id).catch(() => {})
      setResumeAttempt(null)
      return
    }
    attemptIdRef.current = attempt.id
    startedAtRef.current = attempt.started_at
    setSections(savedSections)
    setSectionIndex(config?.sectionIndex ?? 0)
    const restoredAnswers = new Map<string, string>()
    for (const [k, v] of Object.entries(attempt.answers || {})) {
      restoredAnswers.set(k, v)
    }
    setAnswers(restoredAnswers)
    sectionTimesRef.current = {
      listening: attempt.section_times?.listening ?? 0,
      reading: attempt.section_times?.reading ?? 0,
      writing: attempt.section_times?.writing ?? 0,
    }
    sectionStartRef.current = Date.now()
    setWarnings([])
    setWarningDismissed(false)
    setResumeAttempt(null)
    setPhase('section')
  }, [resumeAttempt])

  const handleDiscardResume = useCallback(() => {
    if (resumeAttempt) {
      examAttemptService.remove(resumeAttempt.id).catch(() => {})
    }
    setResumeAttempt(null)
  }, [resumeAttempt])

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
          resumeAttempt={resumeAttempt}
          onResume={handleResume}
          onDiscardResume={handleDiscardResume}
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
    const visibleWarnings = warnings.length > 0 && !warningDismissed
    return (
      <>
        <SEO {...PAGE_SEO.exam} />
        <div className="max-w-3xl mx-auto space-y-4">
          {visibleWarnings && (
            <div className="card p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                {warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
              <button
                onClick={() => setWarningDismissed(true)}
                className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <ExamSectionRunner
            key={section.id}
            section={section}
            sectionIndex={sectionIndex}
            totalSections={3}
            answers={answers}
            onAnswer={handleAnswer}
            onFinishSection={handleFinishSection}
            allowPause={sessionRef.current?.length === 'practice'}
          />
        </div>
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
