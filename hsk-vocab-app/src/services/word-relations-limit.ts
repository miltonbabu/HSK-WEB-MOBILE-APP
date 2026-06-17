// Per-user, per-day counter for "Word Relations" generations on the
// Vocabulary page. We use localStorage rather than the database because
// this counter is a UI affordance (prevent spam-clicks of the LLM
// button) and doesn't need to be cross-device — it auto-resets at
// midnight in the user's local timezone, just like the existing
// rate-limit service.

const STORAGE_KEY = 'hsk-word-relations-count'
const STORAGE_DAY_KEY = 'hsk-word-relations-day'

export const GUEST_WORD_RELATIONS_LIMIT = 5
export const REGISTERED_WORD_RELATIONS_LIMIT = 20

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getLimit(isGuest: boolean): number {
  return isGuest ? GUEST_WORD_RELATIONS_LIMIT : REGISTERED_WORD_RELATIONS_LIMIT
}

function readCount(): { day: string; count: number } {
  if (typeof localStorage === 'undefined') return { day: getTodayKey(), count: 0 }
  const today = getTodayKey()
  const storedDay = localStorage.getItem(STORAGE_DAY_KEY)
  if (storedDay !== today) {
    // New day — reset the counter but keep the key fresh so we don't
    // re-write on every read.
    localStorage.setItem(STORAGE_DAY_KEY, today)
    localStorage.setItem(STORAGE_KEY, '0')
    return { day: today, count: 0 }
  }
  const raw = localStorage.getItem(STORAGE_KEY)
  return { day: today, count: Number(raw || 0) }
}

function writeCount(count: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_DAY_KEY, getTodayKey())
  localStorage.setItem(STORAGE_KEY, String(count))
}

export interface WordRelationsQuota {
  /** Maximum generations allowed today for this user. */
  limit: number
  /** Generations already consumed today. */
  used: number
  /** Generations left for today. */
  remaining: number
  /** Resets at midnight in the user's local timezone. */
  resetsAt: string
}

export const wordRelationsLimiter = {
  getQuota(isGuest: boolean): WordRelationsQuota {
    const limit = getLimit(isGuest)
    const { count } = readCount()
    const used = Math.min(count, limit)
    const tomorrow = new Date()
    tomorrow.setHours(24, 0, 0, 0)
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetsAt: tomorrow.toISOString(),
    }
  },

  /**
   * Try to consume one generation. Returns the new quota (with
   * `remaining` already decremented) on success, or `null` if the user
   * has hit the daily limit.
   */
  tryConsume(isGuest: boolean): WordRelationsQuota | null {
    const quota = this.getQuota(isGuest)
    if (quota.remaining <= 0) return null
    writeCount(quota.used + 1)
    return {
      ...quota,
      used: quota.used + 1,
      remaining: quota.remaining - 1,
    }
  },

  /**
   * Refund a generation if the LLM call failed. Prevents the user from
   * losing a quota slot to a network/server error.
   */
  refund(isGuest: boolean): void {
    const quota = this.getQuota(isGuest)
    if (quota.used > 0) writeCount(quota.used - 1)
  },
}
