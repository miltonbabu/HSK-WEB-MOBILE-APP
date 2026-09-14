'use client'

import { ArrowLeft, RotateCcw } from 'lucide-react'
import { WritingAnswer, WritingQuestion } from '@/types/writing'

export interface MistakeItem {
  question: WritingQuestion
  answer: WritingAnswer
}

interface Props {
  items: MistakeItem[]
  onPracticeAgain: () => void
  onBack: () => void
}

export default function MistakeReview({ items, onPracticeAgain, onBack }: Props) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-500 dark:text-ink-400 hover:text-red-500">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">Mistake Review</h2>
        <span className="w-12" />
      </div>

      <div className="space-y-3">
        {items.map(({ question, answer }, index) => (
          <div key={question.id} className="card p-4">
            <p className="text-xs text-ink-400 dark:text-ink-500 mb-2">Mistake #{index + 1}</p>

            {question.promptEnglish && (
              <p className="text-sm text-ink-700 dark:text-ink-200">
                <span className="text-ink-400 dark:text-ink-500">Meaning: </span>
                {question.promptEnglish}
              </p>
            )}
            {question.promptPinyin && (
              <p className="text-sm text-ink-700 dark:text-ink-200">
                <span className="text-ink-400 dark:text-ink-500">Pinyin: </span>
                {question.promptPinyin}
              </p>
            )}

            <div className="mt-2 space-y-1">
              <p className="text-sm">
                <span className="text-ink-400 dark:text-ink-500">Your answer: </span>
                <span className="text-red-500 dark:text-red-400 chinese-text">
                  {answer.userAnswer || '—'}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-ink-400 dark:text-ink-500">Correct: </span>
                <span className="text-green-600 dark:text-green-400 chinese-text">{question.expectedAnswer}</span>
              </p>
              {question.pinyin && (
                <p className="text-sm text-ink-500 dark:text-ink-400">{question.pinyin}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <button onClick={onPracticeAgain} className="btn-primary w-full flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Practice these again
        </button>
      )}
    </div>
  )
}