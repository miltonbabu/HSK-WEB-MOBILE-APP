'use client'

import { useEffect, useRef } from 'react'
import { Keyboard, Languages } from 'lucide-react'
import type { PinyinIMEController } from '@/hooks/usePinyinIME'
import CandidateBar from './CandidateBar'
import ChineseKeyboard from './ChineseKeyboard'

interface Props {
  controller: PinyinIMEController
  disabled?: boolean
  showKeyboard: boolean
  imeEnabled: boolean
  onToggleIme: () => void
}

export default function WritingInput({
  controller,
  disabled,
  showKeyboard,
  imeEnabled,
  onToggleIme,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  const handlePunctuation = (char: string) => {
    controller.insertText(char)
    textareaRef.current?.focus()
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 focus-within:border-red-400 transition-colors">
        <textarea
          ref={textareaRef}
          value={controller.committed}
          onChange={(event) => controller.setCommitted(event.target.value)}
          onKeyDown={controller.handleKeyDown}
          disabled={disabled}
          rows={2}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Your Chinese answer"
          placeholder={imeEnabled ? 'Type pinyin, then pick a character' : 'Type Chinese'}
          className="w-full resize-none bg-transparent px-4 py-3 text-2xl sm:text-3xl chinese-text text-ink-900 dark:text-white placeholder:text-base placeholder:text-ink-400 focus:outline-none"
        />

        <div className="flex items-center justify-between gap-2 px-4 pb-2 min-h-[1.75rem]">
          <span className="text-sm text-red-500 dark:text-red-400 min-w-0 truncate">
            {controller.composition && (
              <>
                <span className="text-ink-400 dark:text-ink-500 mr-1">pinyin:</span>
                {controller.composition}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onToggleIme}
            aria-pressed={imeEnabled}
            className={`shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
              imeEnabled
                ? 'border-red-300 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
                : 'border-ink-200 dark:border-ink-700 text-ink-500'
            }`}
            title={imeEnabled ? 'Pinyin IME on — click to use your OS keyboard' : 'Using OS keyboard — click for pinyin IME'}
          >
            <Languages className="w-3.5 h-3.5" />
            {imeEnabled ? 'Pinyin IME' : 'Native input'}
          </button>
        </div>
      </div>

      <CandidateBar
        candidates={controller.candidates}
        activeIndex={controller.activeIndex}
        onSelect={controller.selectCandidate}
      />

      <div className="flex items-center justify-between text-xs text-ink-400 dark:text-ink-500">
        <span>Enter to submit • 1–9 to pick a candidate • Backspace to delete</span>
        {showKeyboard && <Keyboard className="w-4 h-4" aria-hidden />}
      </div>

      {showKeyboard && (
        <ChineseKeyboard
          onLetter={controller.typeLetter}
          onPunctuation={handlePunctuation}
          onBackspace={controller.backspace}
          onSpace={() => controller.selectCandidate()}
          disabled={disabled}
        />
      )}
    </div>
  )
}