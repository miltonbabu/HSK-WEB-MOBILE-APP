'use client'

import { ArrowRight, Check, X } from 'lucide-react'
import { AnswerEvaluation, WritingQuestion } from '@/types/writing'

interface Props {
  question: WritingQuestion
  evaluation: AnswerEvaluation
  isLast: boolean
  onNext: () => void
}

export default function AnswerFeedback({ question, evaluation, isLast, onNext }: Props) {
  const expectedOps = evaluation.diff.filter((op) => op.kind !== 'extra')
  const actualOps = evaluation.diff.filter((op) => op.kind !== 'missing')

  return (
    <div
      className={`card p-5 sm:p-6 border ${
        evaluation.correct
          ? 'border-green-200 dark:border-green-500/30'
          : 'border-red-200 dark:border-red-500/30'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {evaluation.correct ? (
          <>
            <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            </span>
            <span className="font-semibold text-green-700 dark:text-green-400">Correct</span>
          </>
        ) : (
          <>
            <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            </span>
            <span className="font-semibold text-red-700 dark:text-red-400">
              Not quite — {evaluation.correctChars} / {evaluation.totalChars} characters correct
            </span>
          </>
        )}
      </div>

      {!evaluation.correct && (
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500 mb-1">Correct</p>
            <p className="text-2xl chinese-text text-green-700 dark:text-green-400">
              {expectedOps.map((op, i) => (
                <span key={i} className={op.kind === 'same' ? '' : 'text-red-500 dark:text-red-400 underline decoration-wavy'}>
                  {op.expectedChar}
                </span>
              ))}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500 mb-1">Your answer</p>
            <p className="text-2xl chinese-text text-ink-800 dark:text-ink-100">
              {actualOps.length === 0 ? (
                <span className="text-ink-400 italic text-base">no answer</span>
              ) : (
                actualOps.map((op, i) => (
                  <span key={i} className={op.kind === 'same' ? '' : 'text-red-500 dark:text-red-400 underline decoration-wavy'}>
                    {op.actualChar}
                  </span>
                ))
              )}
            </p>
          </div>
          <p className="text-ink-500 dark:text-ink-400">
            <span className="chinese-text">{question.expectedAnswer}</span>
            {' · '}
            {question.pinyin}
            {question.meaning && <span className="text-ink-400 dark:text-ink-500"> — {question.meaning}</span>}
          </p>
        </div>
      )}

      {evaluation.correct && question.meaning && (
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          <span className="chinese-text">{question.expectedAnswer}</span> · {question.pinyin} — {question.meaning}
        </p>
      )}

      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="btn-primary w-full mt-5 flex items-center justify-center gap-2"
      >
        {isLast ? 'See results' : 'Next'}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}