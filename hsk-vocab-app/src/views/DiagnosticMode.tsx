'use client'

import { useCallback, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useAuthStore, useProgressStore } from '@/stores'
import { HSKLevel } from '@/types'
import { ExamSection, ExamSectionId, ExamResult, GenerateProgress } from '@/types/exam'
import { DiagnosticAnalysis } from '@/services/diagnostic.service'
import { analyzeDiagnostic } from '@/services/diagnostic.service'
import { diagnosticService } from '@/services/sqlite-api'
import { generateExam, gradeExam } from '@/services/exam.service'
import { recordStudySession } from '@/utils/study-helpers'
import ExamSectionRunner from '@/components/exam/ExamSectionRunner'

type Phase = 'setup' | 'section' | 'result'

export default function DiagnosticMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const userId = user?.id || 'guest'

  const [phase, setPhase] = useState<Phase>('setup')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<GenerateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [sections, setSections] = useState<ExamSection[]>([])
  const [sectionIndex, setSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [report, setReport] = useState<DiagnosticAnalysis | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)

  const levelRef = useRef<HSKLevel>(3)
  const startRef = useRef<number>(Date.now())
  const timesRef = useRef<Record<ExamSectionId, number>>({ listening: 0, reading: 0, writing: 0 })
  const abortRef = useRef<AbortController | null>(null)

  const handleStart = useCallback(async (level: HSKLevel) => {
    setLoading(true)
    setError(null)
    levelRef.current = level
    setProgress({ step: 'questions', done: 0, total: 1, message: 'Loading vocabulary…' })
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    try {
      const secs = await generateExam('practice', level, signal, (p) => setProgress(p))
      if (secs.length === 0) throw new Error('No questions could be generated.')
      setSections(secs)
      setSectionIndex(0)
      setAnswers(new Map())
      setResult(null)
      setReport(null)
      timesRef.current = { listening: 0, reading: 0, writing: 0 }
      startRef.current = Date.now()
      setPhase('section')
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Failed to start diagnostic.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [])

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, answer)
      return next
    })
  }, [])

  const handleFinishSection = useCallback(async () => {
    const current = sections[sectionIndex]
    if (current) {
      timesRef.current[current.id] = Math.round((Date.now() - startRef.current) / 1000)
    }

    const nextIdx = sectionIndex + 1
    if (nextIdx < sections.length) {
      setSectionIndex(nextIdx)
      startRef.current = Date.now()
      return
    }

    // All sections done → grade + analyze + persist.
    const res = gradeExam(sections, answers, timesRef.current)
    setResult(res)
    setPhase('result')

    const analysis = await analyzeDiagnostic(userId, levelRef.current, res)
    setReport(analysis)

    await diagnosticService.save({
      user_id: userId,
      hsk_level: levelRef.current,
      overall: analysis.overall,
      skill_scores: analysis.skill_scores,
      weak_words: analysis.weak_words,
      level3_mastery: analysis.level3_mastery,
      level4_readiness: analysis.level4_readiness,
    })

    const accuracy = Math.round((res.correctCount / Math.max(res.totalQuestions, 1)) * 100)
    recordStudySession(userId, 'diagnostic', res.totalQuestions, accuracy, res.durationSec)
  }, [sections, sectionIndex, answers, userId])

  const handleRetake = useCallback(() => {
    abortRef.current?.abort()
    setSections([])
    setAnswers(new Map())
    setResult(null)
    setReport(null)
    setError(null)
    setSectionIndex(0)
    setPhase('setup')
  }, [])

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white mt-3">Diagnostic failed to load</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-2">{error}</p>
        <button onClick={handleRetake} className="btn-primary mt-4">Try again</button>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <div className="max-w-md mx-auto pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Diagnostic</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          A short estimate of your HSK skills — not an official result.
        </p>
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

  if (phase === 'section' && sections.length > 0 && sections[sectionIndex]) {
    const section = sections[sectionIndex]
    return (
      <ExamSectionRunner
        key={section.id}
        section={section}
        sectionIndex={sectionIndex}
        totalSections={sections.length}
        answers={answers}
        onAnswer={handleAnswer}
        onFinishSection={handleFinishSection}
        allowPause
      />
    )
  }

  if (phase === 'result' && report && result) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="card p-6 text-center">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white">Diagnostic Report</h2>
          <p className="mt-1 text-3xl font-extrabold text-red-500">{report.overall}<span className="text-lg text-ink-400">%</span></p>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
            {result.correctCount}/{result.totalQuestions} questions correct · estimate only
          </p>
        </div>

        {report.skill_scores.length > 0 && (
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Skill breakdown</h3>
            {report.skill_scores.map((s) => (
              <div key={s.skill}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold capitalize text-ink-700 dark:text-ink-200">{s.skill}</span>
                  <span className="text-ink-500 dark:text-ink-400">{s.score}%</span>
                </div>
                <div className="h-2 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.score >= 60 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${s.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {report.weak_words.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-2">Words to review</h3>
            <div className="flex flex-wrap gap-2">
              {report.weak_words.map((w) => (
                <span key={w} className="chinese-text px-3 py-1 rounded-lg bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 text-sm">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {(report.level3_mastery !== null || report.level4_readiness !== null) && (
          <div className="card p-4 text-sm text-ink-700 dark:text-ink-200 space-y-1">
            {report.level3_mastery !== null && <p>Level 3 mastery: <strong>{report.level3_mastery}%</strong></p>}
            {report.level4_readiness !== null && <p>Level 4 readiness: <strong>{report.level4_readiness}%</strong></p>}
          </div>
        )}

        <button onClick={handleRetake} className="btn-primary w-full flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Retake diagnostic
        </button>
      </div>
    )
  }

  return null
}