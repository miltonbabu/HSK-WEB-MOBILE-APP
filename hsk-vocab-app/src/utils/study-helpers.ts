import { progressService, sessionService, updateStreak } from '@/services/sqlite-api'
import { calculateSM2 } from '@/utils/srs'
import { UserProgress, LearningMode } from '@/types'

/**
 * Update SRS progress for a single word after an answer.
 * quality: 0=wrong, 1=almost, 2=hard, 3=good, 4=easy, 5=perfect
 */
export async function updateWordProgress(
  wordId: string,
  quality: 0 | 1 | 2 | 3 | 4 | 5,
  userId: string,
  existingProgress?: UserProgress | null
): Promise<void> {
  const prev = existingProgress || {
    mastery_level: 0,
    easiness_factor: 2.5,
    interval: 1,
    review_count: 0,
    correct_count: 0,
  }

  const result = calculateSM2(
    quality,
    prev.easiness_factor,
    prev.interval,
    prev.review_count
  )

  await progressService.updateProgress(
    {
      word_id: wordId,
      mastery_level: result.mastery_level,
      easiness_factor: result.easiness_factor,
      interval: result.interval,
      next_review: result.next_review.toISOString(),
      correct_count: quality >= 3 ? 1 : 0,
    },
    userId
  )
}

/**
 * Convert a correct/incorrect result to an SM2 quality score.
 */
export function correctToQuality(correct: boolean, attempts?: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!correct) return 0
  if (attempts && attempts > 2) return 3 // Got it but took multiple tries
  if (attempts && attempts > 1) return 4 // Got it after one retry
  return 5 // First try
}

/**
 * Record a completed study session and update streak.
 */
export async function recordStudySession(
  userId: string,
  mode: LearningMode,
  wordsStudied: number,
  accuracy: number,
  durationSeconds: number
): Promise<void> {
  await sessionService.recordSession({
    user_id: userId,
    mode,
    words_studied: wordsStudied,
    accuracy,
    duration: durationSeconds,
  })
  await updateStreak(userId)
}
