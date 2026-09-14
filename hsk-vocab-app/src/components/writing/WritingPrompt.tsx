'use client'

import { WritingDirection, WritingQuestion } from '@/types/writing'

interface Props {
  question: WritingQuestion
  direction: WritingDirection
}

function instruction(direction: WritingDirection, type: WritingQuestion['type']): string {
  if (type === 'sentence') return 'Write this sentence in Chinese'
  switch (direction) {
    case 'en-pinyin':
      return 'Write the Chinese for this word'
    case 'pinyin':
      return 'Write the Chinese for this pinyin'
    case 'en':
      return 'Write the Chinese for this meaning'
    case 'zh-pinyin':
    case 'zh':
      return 'Write this word in Chinese'
    default:
      return 'Write the Chinese'
  }
}

export default function WritingPrompt({ question, direction }: Props) {
  return (
    <div className="card p-5 sm:p-6">
      <p className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
        {instruction(direction, question.type)}
      </p>

      <div className="mt-3 space-y-2">
        {question.promptChinese && (
          <p className="text-3xl sm:text-4xl chinese-text text-ink-900 dark:text-white">
            {question.promptChinese}
          </p>
        )}
        {question.promptEnglish && (
          <p className="text-xl sm:text-2xl font-semibold text-ink-800 dark:text-ink-100">
            {question.promptEnglish}
          </p>
        )}
        {question.promptPinyin && (
          <p className="text-lg text-red-500 dark:text-red-400">{question.promptPinyin}</p>
        )}
      </div>

      {question.type === 'sentence' && question.targetWords.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-400 dark:text-ink-500">Target word</span>
          {question.targetWords.map((word) => (
            <span
              key={word}
              className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 chinese-text"
            >
              {word}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}