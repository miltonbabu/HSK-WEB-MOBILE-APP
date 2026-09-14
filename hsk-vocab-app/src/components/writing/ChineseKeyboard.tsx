'use client'

import { Delete } from 'lucide-react'

const ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

const PUNCTUATION = ['，', '。', '？', '！', '：']

interface Props {
  onLetter: (letter: string) => void
  onPunctuation: (char: string) => void
  onBackspace: () => void
  onSpace: () => void
  disabled?: boolean
}

export default function ChineseKeyboard({
  onLetter,
  onPunctuation,
  onBackspace,
  onSpace,
  disabled,
}: Props) {
  const keyClass =
    'flex-1 min-w-0 h-11 sm:h-12 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-800 dark:text-ink-100 text-base font-medium active:bg-ink-100 dark:active:bg-ink-700 disabled:opacity-40'

  return (
    <div className="select-none space-y-1.5" aria-label="On-screen pinyin keyboard">
      <div className="flex gap-1.5">
        {PUNCTUATION.map((char) => (
          <button
            key={char}
            type="button"
            disabled={disabled}
            onClick={() => onPunctuation(char)}
            className={`${keyClass} max-w-[3.5rem]`}
            aria-label={`Insert ${char}`}
          >
            {char}
          </button>
        ))}
      </div>

      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1.5 justify-center">
          {row.map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={disabled}
              onClick={() => onLetter(letter)}
              className={keyClass}
              aria-label={`Letter ${letter}`}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}

      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onSpace}
          className={`${keyClass} flex-[3]`}
          aria-label="Confirm candidate"
        >
          space
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          className={`${keyClass} flex-[1.5] flex items-center justify-center`}
          aria-label="Backspace"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}