'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useAuthStore, useProgressStore, useSettingsStore } from '@/stores'
import { getImeDictionary, type ImeDictionary } from '@/services/ime'
import {
  buildSentenceStubs,
  buildVocabularyQuestions,
  writingService,
} from '@/services/writing.service'
import { recordStudySession, updateWordProgress } from '@/utils/study-helpers'
import { recordMistake } from '@/services/mistakes.service'
import { HSKLevel } from '@/types'
import {
  AnswerEvaluation,
  WritingAnswer,
  WritingAttemptRecord,
  WritingQuestion,
  WritingResultSummary,
  WritingSettings,
} from '@/types/writing'
import WritingSetup from './WritingSetup'
import WritingRunner from './WritingRunner'
import WritingResult from './WritingResult'
import MistakeReview, { MistakeItem } from './MistakeReview'

type Phase = 'setup' | 'session' | 'result' | 'review'

export default function WritingPractice() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const { hskVersion, hskLevel: settingsLevel } = useSettingsStore()
  const userId = user?.id || 'guest'

  const [settings, setSettings] = useState<WritingSettings>({
    hskLevel: (selectedLevel || settingsLevel || 2) as HSKLevel,
    scope: 'level',
    direction: 'en-pinyin',
    order: 'random',
    questionCount: 20,
    difficulty: 'medium',
  })

  const [phase, setPhase] = useState<Phase>('setup')
  const [dictionary, setDictionary] = useState<ImeDictionary | null>(null)
  const [questions, setQuestions] = useState<WritingQuestion[]>([])
  const [answers, setAnswers] = useState<WritingAnswer[]>([])
  const [summary, setSummary] = useState<WritingResultSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    getImeDictionary()
      .then(setDictionary)
      .catch(() => setDictionary(null))
  }, [])

  const updateSettings = useCallback((patch: Partial<WritingSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const beginSession = useCallback((nextQuestions: WritingQuestion[]) => {
    if (nextQuestions.length === 0) {
      setError('No vocabulary matched your settings. Try a different level or scope.')
      return
    }
    setQuestions(nextQuestions)
    setAnswers([])
    setSummary(null)
    setError(null)
    setSessionId(`ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`)
    setSessionKey((prev) => prev + 1)
    setPhase('session')
  }, [])

  const handleStart = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (settings.direction === 'sentence') {
        const stubs = await buildSentenceStubs({
          hskLevel: settings.hskLevel,
          scope: settings.scope,
          order: settings.order,
          questionCount: settings.questionCount,
          version: hskVersion,
        })
        beginSession(stubs)
      } else {
        const built = await buildVocabularyQuestions({
          direction: settings.direction,
          hskLevel: settings.hskLevel,
          scope: settings.scope,
          order: settings.order,
          questionCount: settings.questionCount,
          version: hskVersion,
        })
        beginSession(built)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to prepare practice.')
    } finally {
      setLoading(false)
    }
  }, [settings, hskVersion, beginSession])

  const handleAttempt = useCallback(
    (record: WritingAttemptRecord, question: WritingQuestion, evaluation: AnswerEvaluation) => {
      const attempt: WritingAttemptRecord = {
        ...record,
        id: `${record.id}_${sessionId}`,
        session_id: sessionId,
        user_id: userId,
      }
      writingService.saveAttempt(attempt).catch(() => {})

      if (question.wordId) {
        updateWordProgress(question.wordId, evaluation.correct ? 5 : 0, userId).catch(() => {})
      }

      if (!evaluation.correct) {
        recordMistake({
          user_id: userId,
          question_id: null,
          word_id: question.wordId,
          skill: 'writing',
          prompt:
            question.promptEnglish ||
            question.promptChinese ||
            question.promptPinyin ||
            question.expectedAnswer,
          user_answer: record.user_answer,
          correct_answer: question.expectedAnswer,
          explanation: question.pinyin,
        }).catch(() => {})
      }
    },
    [sessionId, userId],
  )

  const handleComplete = useCallback(
    async (finalAnswers: WritingAnswer[], finalQuestions: WritingQuestion[], durationSec: number) => {
      const total = finalQuestions.length
      const correctCount = finalAnswers.filter((a) => a.evaluation.correct).length
      const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
      const averageTime =
        finalAnswers.length > 0
          ? finalAnswers.reduce((sum, a) => sum + a.timeTaken, 0) / finalAnswers.length
          : 0

      const weakWords = Array.from(
        new Set(
          finalAnswers
            .filter((a) => !a.evaluation.correct)
            .map((a) => finalQuestions.find((q) => q.id === a.questionId)?.expectedAnswer || '')
            .filter(Boolean),
        ),
      ).slice(0, 8)

      const characterMistakes = Array.from(
        new Set(
          finalAnswers.flatMap((a) =>
            a.evaluation.diff
              .filter((op) => op.kind === 'wrong' || op.kind === 'missing')
              .map((op) => op.expectedChar)
              .filter((char): char is string => Boolean(char)),
          ),
        ),
      ).slice(0, 12)

      const completedAt = new Date().toISOString()
      writingService
        .saveSession({
          id: sessionId,
          user_id: userId,
          hsk_level: settings.hskLevel,
          scope: settings.scope,
          practice_mode: settings.direction,
          order_type: settings.order,
          question_count: total,
          correct_count: correctCount,
          accuracy,
          started_at: new Date(Date.now() - durationSec * 1000).toISOString(),
          completed_at: completedAt,
        })
        .catch(() => {})

      recordStudySession(userId, 'writing', total, accuracy, durationSec).catch(() => {})

      setAnswers(finalAnswers)
      setSummary({
        sessionId,
        totalQuestions: total,
        correctCount,
        accuracy,
        averageTime,
        durationSec,
        weakWords,
        characterMistakes,
      })
      setPhase('result')
    },
    [sessionId, userId, settings],
  )

  const handlePracticeAgain = useCallback(() => {
    void handleStart()
  }, [handleStart])

  const handleBackToSetup = useCallback(() => {
    setPhase('setup')
    setAnswers([])
    setSummary(null)
    setQuestions([])
    setError(null)
  }, [])

  const wrongItems: MistakeItem[] = answers
    .map((answer) => ({
      answer,
      question: questions.find((q) => q.id === answer.questionId),
    }))
    .filter((item): item is MistakeItem => Boolean(item.question) && !item.answer.evaluation.correct)

  const handleRetryMistakes = useCallback(() => {
    const retryQuestions = wrongItems.map((item) => item.question)
    beginSession(retryQuestions)
  }, [wrongItems, beginSession])

  if (phase === 'setup') {
    return (
      <WritingSetup
        settings={settings}
        onChange={updateSettings}
        onStart={handleStart}
        loading={loading}
        error={error}
      />
    )
  }

  if (phase === 'session') {
    return (
      <WritingRunner
        key={sessionKey}
        questions={questions}
        settings={settings}
        dictionary={dictionary}
        onSubmit={handleAttempt}
        onComplete={handleComplete}
        onQuit={handleBackToSetup}
      />
    )
  }

  if (phase === 'review') {
    return (
      <MistakeReview
        items={wrongItems}
        onPracticeAgain={handleRetryMistakes}
        onBack={() => setPhase('result')}
      />
    )
  }

  if (phase === 'result' && summary) {
    return (
      <WritingResult
        summary={summary}
        hasMistakes={wrongItems.length > 0}
        onReview={() => setPhase('review')}
        onPracticeAgain={handlePracticeAgain}
        onBackToSetup={handleBackToSetup}
      />
    )
  }

  return (
    <div className="max-w-md mx-auto text-center py-12 space-y-3">
      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
      <p className="text-sm text-ink-500 dark:text-ink-400">Something went wrong. Please try again.</p>
      <button onClick={handleBackToSetup} className="btn-primary inline-flex items-center gap-2">
        <RotateCcw className="w-4 h-4" />
        Back to settings
      </button>
    </div>
  )
}