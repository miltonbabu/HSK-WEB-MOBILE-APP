'use client'

import { WritingImeCandidate } from '@/types/writing'

interface Props {
  candidates: WritingImeCandidate[]
  activeIndex: number
  onSelect: (index: number) => void
}

export default function CandidateBar({ candidates, activeIndex, onSelect }: Props) {
  if (candidates.length === 0) return null

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1"
      role="listbox"
      aria-label="Chinese candidate suggestions"
    >
      {candidates.map((candidate, index) => (
        <button
          key={`${candidate.text}-${index}`}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onClick={() => onSelect(index)}
          className={`shrink-0 min-w-[3rem] px-3 py-2 rounded-xl border text-lg leading-none transition-colors ${
            index === activeIndex
              ? 'border-red-400 bg-red-50 dark:bg-red-500/10 text-ink-900 dark:text-white'
              : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-800 dark:text-ink-100 hover:border-red-300'
          }`}
          title={candidate.pinyin}
        >
          <span className="block text-center">{candidate.text}</span>
          {index < 9 && (
            <span className="block text-center text-[10px] text-ink-400 mt-0.5">{index + 1}</span>
          )}
        </button>
      ))}
    </div>
  )
}