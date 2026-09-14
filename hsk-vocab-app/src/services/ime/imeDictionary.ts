import { Word } from '@/types'
import { WritingImeCandidate } from '@/types/writing'
import { segmentPinyin, stripTones } from '@/utils/pinyin-ime'

// Pinyin IME dictionary, derived entirely from the app's existing HSK
// vocabulary. Words contribute both whole-word entries (phrase-aware) and,
// where the pinyin segments one-to-one onto the characters, single-character
// entries. Typing a syllable sequence that is not itself a stored word is
// synthesised from the highest-frequency character for each syllable.

const LEVEL_WEIGHT: Record<number, number> = { 1: 6000, 2: 4000, 3: 2500, 4: 1200, 5: 600, 6: 300 }

const EXACT_BONUS = 1_000_000
const SYNTH_BONUS = 400_000
const PREFIX_BONUS = 30_000

interface ScoredCandidate {
  candidate: WritingImeCandidate
  score: number
}

export interface ImeDictionary {
  candidatesFor(composition: string, limit?: number): WritingImeCandidate[]
  readonly size: number
}

export function createImeDictionary(words: Word[]): ImeDictionary {
  const byPinyin = new Map<string, Map<string, WritingImeCandidate>>()
  const syllableTop = new Map<string, WritingImeCandidate>()

  const register = (entry: WritingImeCandidate): void => {
    let list = byPinyin.get(entry.pinyin)
    if (!list) {
      list = new Map()
      byPinyin.set(entry.pinyin, list)
    }
    const existing = list.get(entry.text)
    if (!existing || existing.frequency < entry.frequency) {
      list.set(entry.text, entry)
    }

    if (entry.kind === 'char') {
      const top = syllableTop.get(entry.pinyin)
      if (!top || top.frequency < entry.frequency) {
        syllableTop.set(entry.pinyin, entry)
      }
    }
  }

  for (const word of words) {
    const chinese = (word.chinese || '').trim()
    if (!chinese) continue

    const pinyin = stripTones(word.pinyin)
    if (!pinyin) continue

    const weight = LEVEL_WEIGHT[word.hsk_level] ?? 300
    const chars = Array.from(chinese)

    register({
      text: chinese,
      pinyin,
      frequency: weight + chars.length * 10,
      kind: chars.length > 1 ? 'word' : 'char',
    })

    if (chars.length > 1) {
      const syllables = segmentPinyin(word.pinyin)
      if (syllables && syllables.length === chars.length) {
        for (let i = 0; i < chars.length; i++) {
          register({
            text: chars[i],
            pinyin: syllables[i],
            frequency: weight + 400,
            kind: 'char',
          })
        }
      }
    }
  }

  const size = byPinyin.size

  function candidatesFor(composition: string, limit = 9): WritingImeCandidate[] {
    const query = stripTones(composition)
    if (!query) return []

    const scored = new Map<string, ScoredCandidate>()

    const consider = (candidate: WritingImeCandidate, score: number): void => {
      const current = scored.get(candidate.text)
      if (!current || current.score < score) {
        scored.set(candidate.text, { candidate, score })
      }
    }

    const exact = byPinyin.get(query)
    if (exact) {
      for (const candidate of exact.values()) {
        consider(candidate, candidate.frequency + EXACT_BONUS)
      }
    }

    for (const [key, list] of byPinyin) {
      if (key.length <= query.length || !key.startsWith(query)) continue
      const gap = key.length - query.length
      for (const candidate of list.values()) {
        const kindBonus = candidate.kind === 'word' ? 2000 : 0
        consider(candidate, candidate.frequency + PREFIX_BONUS + kindBonus - gap * 500)
      }
    }

    const syllables = segmentPinyin(query)
    if (syllables && syllables.length > 1) {
      const parts: string[] = []
      let total = 0
      let complete = true
      for (const syllable of syllables) {
        const top = syllableTop.get(syllable)
        if (!top) {
          complete = false
          break
        }
        parts.push(top.text)
        total += top.frequency
      }
      if (complete) {
        const text = parts.join('')
        consider(
          { text, pinyin: query, frequency: total, kind: 'phrase' },
          total + SYNTH_BONUS,
        )
      }
    }

    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score || b.candidate.frequency - a.candidate.frequency)
      .slice(0, limit)
      .map((entry) => entry.candidate)
  }

  return { candidatesFor, size }
}