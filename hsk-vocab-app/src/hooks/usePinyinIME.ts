'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ImeDictionary } from '@/services/ime'
import { WritingImeCandidate } from '@/types/writing'

const LETTER = /^[a-z]$/
const MAX_COMPOSITION = 40

export interface PinyinIMEController {
  committed: string
  composition: string
  /** Every pinyin letter typed for the current answer (learning analytics). */
  rawPinyin: string
  candidates: WritingImeCandidate[]
  activeIndex: number
  /** Route a physical/on-screen letter into the pinyin composition. */
  typeLetter: (letter: string) => void
  /** Commit a candidate (defaults to the highlighted one) into the answer. */
  selectCandidate: (index?: number) => void
  /** Backspace: edit the composition first, then the committed answer. */
  backspace: () => void
  moveActive: (delta: number) => void
  /** Insert raw text (punctuation, pasted Chinese) straight into the answer. */
  insertText: (text: string) => void
  clearComposition: () => void
  setCommitted: (value: string) => void
  reset: (value?: string) => void
  handleKeyDown: (event: React.KeyboardEvent) => void
}

export interface UsePinyinIMEOptions {
  dictionary: ImeDictionary | null
  initialValue?: string
  maxCandidates?: number
  /** Called on Enter when no composition is active. */
  onSubmit?: () => void
  /** Enable the pinyin IME; disable to let the OS Chinese keyboard through. */
  imeEnabled?: boolean
}

/**
 * State machine for pinyin composition → candidate selection → committed text.
 * Kept UI-free so it can be unit-tested and reused by desktop + mobile.
 */
export function usePinyinIME({
  dictionary,
  initialValue = '',
  maxCandidates = 9,
  onSubmit,
  imeEnabled = true,
}: UsePinyinIMEOptions): PinyinIMEController {
  const [committed, setCommittedState] = useState(initialValue)
  const [composition, setComposition] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [rawPinyin, setRawPinyin] = useState('')

  const candidates = useMemo(() => {
    if (!dictionary || !composition) return []
    return dictionary.candidatesFor(composition, maxCandidates)
  }, [dictionary, composition, maxCandidates])

  const selectCandidate = useCallback(
    (index?: number) => {
      const target = candidates[index ?? activeIndex]
      if (!target) return
      setCommittedState((prev) => prev + target.text)
      setComposition('')
      setActiveIndex(0)
    },
    [candidates, activeIndex],
  )

  const typeLetter = useCallback((letter: string) => {
    if (!LETTER.test(letter)) return
    setComposition((prev) => (prev.length >= MAX_COMPOSITION ? prev : prev + letter))
    setRawPinyin((prev) => (prev.length >= 200 ? prev : prev + letter))
    setActiveIndex(0)
  }, [])

  const backspace = useCallback(() => {
    setComposition((prev) => {
      if (prev.length > 0) {
        setActiveIndex(0)
        return prev.slice(0, -1)
      }
      setCommittedState((value) => Array.from(value).slice(0, -1).join(''))
      return prev
    })
  }, [])

  const moveActive = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => {
        if (candidates.length === 0) return 0
        return (prev + delta + candidates.length) % candidates.length
      })
    },
    [candidates.length],
  )

  const insertText = useCallback((text: string) => {
    if (!text) return
    setCommittedState((prev) => prev + text)
  }, [])

  const clearComposition = useCallback(() => {
    setComposition('')
    setActiveIndex(0)
  }, [])

  const setCommitted = useCallback((value: string) => {
    setCommittedState(value)
    setComposition('')
    setActiveIndex(0)
  }, [])

  const reset = useCallback((value = '') => {
    setCommittedState(value)
    setComposition('')
    setActiveIndex(0)
    setRawPinyin('')
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { key, ctrlKey, metaKey, altKey } = event
      if (ctrlKey || metaKey || altKey) return

      const composing = composition.length > 0

      if (composing) {
        if (key === 'Backspace') {
          event.preventDefault()
          backspace()
          return
        }
        if (key === 'ArrowLeft' || key === 'ArrowUp') {
          event.preventDefault()
          moveActive(-1)
          return
        }
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          event.preventDefault()
          moveActive(1)
          return
        }
        if (key === 'Escape') {
          event.preventDefault()
          clearComposition()
          return
        }
        if (key === ' ' || key === 'Enter') {
          event.preventDefault()
          selectCandidate()
          return
        }
        if (/^[1-9]$/.test(key)) {
          event.preventDefault()
          selectCandidate(Number(key) - 1)
          return
        }
      }

      if (key === 'Enter' && !composing) {
        event.preventDefault()
        onSubmit?.()
        return
      }

      if (imeEnabled && LETTER.test(key.toLowerCase()) && !event.shiftKey) {
        event.preventDefault()
        typeLetter(key.toLowerCase())
      }
    },
    [composition, backspace, moveActive, clearComposition, selectCandidate, onSubmit, imeEnabled, typeLetter],
  )

  return {
    committed,
    composition,
    rawPinyin,
    candidates,
    activeIndex,
    typeLetter,
    selectCandidate,
    backspace,
    moveActive,
    insertText,
    clearComposition,
    setCommitted,
    reset,
    handleKeyDown,
  }
}
