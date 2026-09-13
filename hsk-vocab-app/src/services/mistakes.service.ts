import { mistakeService } from './sqlite-api'
import { NewMistake, Mistake } from '@/types/learning'
import { updateWordProgress } from '@/utils/study-helpers'

/**
 * Record a mistake into the notebook and feed the SRS so the target word
 * resurfaces in weak-word review. Dedupes by (user, word, skill) so repeated
 * misses on the same word don't create duplicate rows.
 */
export async function recordMistake(input: NewMistake): Promise<Mistake> {
  const existing = await mistakeService.list(input.user_id)
  const dup = existing.find(
    (m) => !m.mastered && m.word_id != null && m.word_id === input.word_id && m.skill === input.skill,
  )
  if (dup) {
    await mistakeService.retry(dup.id)
    return dup
  }

  const saved = await mistakeService.save(input)
  if (input.word_id) {
    updateWordProgress(input.word_id, 0, input.user_id).catch(() => {})
  }
  return saved
}

export function listMistakes(userId: string): Promise<Mistake[]> {
  return mistakeService.list(userId)
}

export function markMastered(id: string, mastered: boolean): Promise<void> {
  return mistakeService.markMastered(id, mastered)
}

export function removeMistake(id: string): Promise<void> {
  return mistakeService.remove(id)
}

/** Mark a mistaken word as now-known and reinforce it in the SRS. */
export async function markCorrect(id: string, userId: string, wordId?: string | null): Promise<void> {
  await mistakeService.markMastered(id, true)
  if (wordId) {
    updateWordProgress(wordId, 5, userId).catch(() => {})
  }
}