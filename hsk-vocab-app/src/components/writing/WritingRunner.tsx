'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePinyinIME } from '@/hooks/usePinyinIME'
import type { ImeDictionary } from '@/services/ime'
import { hydrateSentenceQuestion } from '@/services/writing.service'
import { evaluateAnswer } from '@/utils/answer-eval'
import {
  AnswerEvaluation,
  WritingAnswer,
  WritingAttemptRecord,
  WritingQuestion,
  WritingSettings,
} from '@/types/writing'
import PracticeProgress from './PracticeProgress'
import WritingPrompt from './WritingPrompt'
import WritingInput from './WritingInput'
import AnswerFeedback from './AnswerFeedback'

interface Props {
  questions: WritingQuestion[]
  settings: WritingSettings
  dictionary: ImeDictionary | null
  onSubmit: (attempt: WritingAttemptRecord, question: WritingQuestion, evaluation: AnswerEvaluation) => void
  onComplete: (answers: WritingAnswer[], questions: WritingQuestion[], durationSec: number) => void
  onQuit: () => void
}

export default function WritingRunner({
  questions,
  settings,
  dictionary,
  onSubmit,
  onComplete,
  onQuit,
}: Props) {
  const [index, setIndex] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [current, setCurrent] = useState<WritingQuestion | null>(questions[0] ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null)
  const [imeEnabled, setImeEnabled] = useState(true)
  const [showKeyboard, setShowKeyboard] = useState(true)

  const answersRef = useRef<WritingAnswer[]>([])
  const sessionStartRef = useRef(Date.now())
  const questionStartRef = useRef(Date.now())
  const handleSubmitRef = useRef<() => void>(() => {})

  const controller = usePinyinIME({
    dictionary,
    onSubmit: () => handleSubmitRef.current(),
    imeEnabled,
  })
  const { reset } = controller

  useEffect(() => {
    const question = questions[index]
    if (!question) return undefined

    reset()
    setEvaluation(null)
    setError(null)
    questionStartRef.current = Date.now()

    if (question.type === 'sentence' && !question.expectedAnswer) {
      let cancelled = false
      setLoading(true)
      setCurrent(null)
      hydrateSentenceQuestion(question, settings.difficulty)
        .then((hydrated) => {
          if (!cancelled) setCurrent(hydrated)
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message || 'Could not load a sentence.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    setCurrent(question)
    return undefined
  }, [index, reloadToken, questions, settings.difficulty, reset])

  const handleSubmit = useCallback(() => {
    if (evaluation || loading || !current || !current.expectedAnswer) return

    const timeTaken = (Date.now() - questionStartRef.current) / 1000
    const result = evaluateAnswer(current.expectedAnswer, controller.committed, {
      allowPunctuationDifference: current.type === 'sentence',
    })

    const answer: WritingAnswer = {
      questionId: current.id,
      userAnswer: controller.committed,
      pinyinInput: controller.rawPinyin,
      timeTaken,
      evaluation: result,
    }
    answersRef.current = [...answersRef.current, answer]
    setEvaluation(result)

    const wrongChars = result.diff
      .filter((op) => op.kind === 'wrong' || op.kind === 'missing')
      .map((op) => op.expectedChar)
      .filter((char): char is string => Boolean(char))

    onSubmit(
      {
        id: `wa_${current.id}`,
        session_id: '',
        user_id: '',
        word_id: current.wordId,
        question_type: current.type,
        expected_answer: current.expectedAnswer,
        user_answer: controller.committed,
        pinyin_input: controller.rawPinyin,
        is_correct: result.correct,
        accuracy: result.accuracy,
        time_taken: timeTaken,
        mistakes: JSON.stringify(wrongChars),
        created_at: new Date().toISOString(),
      },
      current,
      result,
    )
  }, [evaluation, loading, current, controller.committed, controller.rawPinyin, onSubmit])

  handleSubmitRef.current = handleSubmit

  const handleNext = useCallback(() => {
    if (index + 1 >= questions.length) {
      const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000)
      onComplete(answersRef.current, questions, durationSec)
      return
    }
    setIndex((prev) => prev + 1)
  }, [index, questions, onComplete])

  const total = questions.length

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PracticeProgress
        current={Math.min(index + 1, total)}
        total={total}
        label={`HSK ${settings.hskLevel} · ${labelFor(settings)}`}
        onQuit={onQuit}
      />

      {loading && (
        <div className="card p-10 flex flex-col items-center justify-center text-ink-500 dark:text-ink-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="mt-3 text-sm">Generating a sentence…</p>
        </div>
      )}

      {error && !loading && (
        <div className="card p-6 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => setReloadToken((prev) => prev + 1)} className="btn-primary mt-4">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && current && (
        <>
          <WritingPrompt question={current} direction={settings.direction} />

          {evaluation ? (
            <AnswerFeedback
              question={current}
              evaluation={evaluation}
              isLast={index + 1 >= total}
              onNext={handleNext}
            />
          ) : (
            <>
              <WritingInput
                controller={controller}

                showKeyboard={showKeyboard}
                imeEnabled={imeEnabled}
                onToggleIme={() => setImeEnabled((prev) => !prev)}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={!controller.committed}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Check
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeyboard((prev) => !prev)}
                  className="btn-secondary px-4"
                >
                  {showKeyboard ? 'Hide keyboard' : 'Show keyboard'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function labelFor(settings: WritingSettings): string {
  return settings.direction === 'sentence' ? 'Sentence writing' : 'Vocabulary'
}
