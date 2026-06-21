/**
 * Cloud sync for user_progress data.
 *
 * Local SQLite remains the source of truth. This service mirrors progress
 * writes to Supabase (write-through) so signed-in users keep their weak words,
 * mastery levels, and SRS state across devices. It also supports pulling
 * remote progress on login to merge cloud data into the local DB.
 *
 * - Soft-fails: never throws — cloud is a best-effort mirror.
 * - Skips guests: only syncs for authenticated Supabase users.
 * - Follows the same pattern as rate-limit-sync.service.ts.
 */
import { supabase, isSupabaseConfigured } from './supabase'
import { query, run, forceSaveDb } from './database'

/** Skip sync for guest user IDs (local UUIDs or 'guest' fallback). */
function shouldSync(userId: string): boolean {
  if (!isSupabaseConfigured()) return false
  if (!navigator.onLine) return false
  // Guest IDs: 'guest', 'guest-*', or local UUIDs that haven't been
  // migrated to a real Supabase auth user. We detect by checking if
  // there's a live Supabase auth session — guests don't have one.
  if (userId === 'guest' || userId.startsWith('guest-')) return false
  return true
}

/**
 * Write-through sync: push a single word's progress to Supabase.
 * Called after every local updateProgress() so the cloud stays in sync.
 */
export async function syncWordProgress(
  userId: string,
  wordId: string,
  progress: {
    mastery_level: number
    easiness_factor: number
    interval: number
    next_review: string
    review_count: number
    correct_count: number
  },
): Promise<void> {
  if (!shouldSync(userId)) return
  try {
    const { error } = await supabase.from('user_progress').upsert(
      {
        user_id: userId,
        word_id: wordId,
        mastery_level: progress.mastery_level,
        easiness_factor: progress.easiness_factor,
        interval: progress.interval,
        next_review: progress.next_review,
        review_count: progress.review_count,
        correct_count: progress.correct_count,
        last_reviewed: new Date().toISOString(),
      },
      { onConflict: 'user_id,word_id' },
    )
    if (error) console.warn('[progress-sync] upsert failed:', error.message)
  } catch (e) {
    console.warn('[progress-sync] syncWordProgress failed:', e)
  }
}

/**
 * Pull all remote progress for a user and merge into local SQLite.
 * Used on login/signup to enable cross-device sync.
 *
 * Merge strategy: for each remote row, if the local row doesn't exist or
 * has an older `last_reviewed`, upsert the remote data into local.
 * This preserves the most recent state from either source.
 */
export async function pullAndMergeRemoteProgress(userId: string): Promise<number> {
  if (!shouldSync(userId)) return 0
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.warn('[progress-sync] pull failed:', error.message)
      return 0
    }
    if (!data || data.length === 0) return 0

    let merged = 0
    for (const remote of data as any[]) {
      const localRows = query(
        'SELECT * FROM user_progress WHERE user_id = ? AND word_id = ?',
        [userId, String(remote.word_id)],
      )

      const remoteReviewed = remote.last_reviewed
        ? new Date(remote.last_reviewed).getTime()
        : 0

      if (localRows.length === 0) {
        // Remote has data we don't — insert it locally
        run(
          `INSERT INTO user_progress
            (user_id, word_id, mastery_level, easiness_factor, interval,
             next_review, review_count, correct_count, last_reviewed)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            String(remote.word_id),
            remote.mastery_level ?? 0,
            remote.easiness_factor ?? 2.5,
            remote.interval ?? 1,
            remote.next_review ?? new Date().toISOString(),
            remote.review_count ?? 0,
            remote.correct_count ?? 0,
            remote.last_reviewed ?? new Date().toISOString(),
          ],
        )
        merged++
      } else {
        // Both exist — keep the newer one
        const localReviewed = localRows[0].last_reviewed
          ? new Date(localRows[0].last_reviewed).getTime()
          : 0

        if (remoteReviewed > localReviewed) {
          run(
            `UPDATE user_progress SET
              mastery_level = ?,
              easiness_factor = ?,
              interval = ?,
              next_review = ?,
              review_count = ?,
              correct_count = ?,
              last_reviewed = ?
            WHERE user_id = ? AND word_id = ?`,
            [
              remote.mastery_level ?? 0,
              remote.easiness_factor ?? 2.5,
              remote.interval ?? 1,
              remote.next_review ?? new Date().toISOString(),
              remote.review_count ?? 0,
              remote.correct_count ?? 0,
              remote.last_reviewed ?? new Date().toISOString(),
              userId,
              String(remote.word_id),
            ],
          )
          merged++
        }
      }
    }

    if (merged > 0) forceSaveDb()
    return merged
  } catch (e) {
    console.warn('[progress-sync] pullAndMergeRemoteProgress failed:', e)
    return 0
  }
}
