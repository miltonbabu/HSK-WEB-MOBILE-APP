import { useRef, useEffect } from 'react'
import { Send, AlertTriangle } from 'lucide-react'
import { useAIInputStore } from '@/stores/aiInputStore'
import { cn } from '@/utils/cn'

interface InputBarProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
  limitReached: boolean
  guestLimit: number
  placeholder?: string
}

export default function InputBar({
  value,
  onChange,
  onSend,
  disabled,
  limitReached,
  guestLimit,
  placeholder = 'Ask about HSK vocabulary…',
}: InputBarProps) {
  const setInputFocused = useAIInputStore((s) => s.setInputFocused)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 144) + 'px'
  }, [value])

  // When the keyboard is dismissed (or focus moves elsewhere), unset the store
  useEffect(() => {
    return () => {
      // best-effort: when component unmounts (e.g. leaving /ai), clear focus flag
      setInputFocused(false)
    }
  }, [setInputFocused])

  const canSend = value.trim().length > 0 && !disabled

  if (limitReached) {
    return (
      <div className="px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-2 bg-red-50/60 dark:bg-red-900/10 border border-red-200/60 dark:border-red-900/30 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-center">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-400">
              Daily message limit reached
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-red-600/70 dark:text-red-400/70">
            Free users can send {guestLimit} messages per day.{' '}
            <a href="/auth?redirect=/ai" className="font-medium underline hover:text-red-700">
              Create an account
            </a>{' '}
            for unlimited chat.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="max-w-3xl mx-auto">
        <div
          className={cn(
            'flex items-end gap-2 bg-white dark:bg-white/5 border rounded-2xl px-2.5 sm:px-3 py-1.5 sm:py-2 transition-all',
            'border-ink-200 dark:border-white/10',
            'focus-within:border-red-400 dark:focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) onSend()
              }
            }}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            enterKeyHint="send"
            autoComplete="off"
            className="flex-1 bg-transparent resize-none px-1 py-1.5 text-xs sm:text-sm text-ink-900 dark:text-white placeholder:text-ink-400 dark:placeholder:text-ink-500 outline-none"
            style={{ minHeight: '24px', maxHeight: '144px' }}
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              'w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all shrink-0',
              !canSend && 'opacity-30 cursor-not-allowed',
            )}
            style={{
              background: canSend
                ? 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
                : 'rgba(139,92,246,0.15)',
              boxShadow: canSend ? '0 2px 8px rgba(139,92,246,0.3)' : 'none',
              color: canSend ? 'white' : '#8b5cf6',
            }}
            aria-label="Send message"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
        <p className="hidden sm:block text-[10px] text-ink-400 dark:text-ink-500 text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
