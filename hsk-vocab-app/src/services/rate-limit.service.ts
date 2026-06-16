import { query, run } from './database'

export interface UsageStats {
  modeUsageCount: number // count of sessions today in this mode
  modeUsageRemaining: number // remaining uses for this mode today
  totalSecondsToday: number // total seconds used today across all modes
  totalMinutesRemaining: number // minutes remaining of 120-min daily cap
  isGuest: boolean
}

export const GUEST_MODE_LIMIT = 10 // 10 uses per mode per day
export const GUEST_DAILY_MINUTES = 120 // 2 hours total per day

const STORAGE_KEY = 'hsk-usage-day' // tracks current local day for resets

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function checkAndRotateDay(): void {
  const today = getTodayKey()
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (stored !== today && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, today)
  }
}

export const rateLimitService = {
  /**
   * Start a usage session. Returns session id to use with endSession().
   */
  startSession(userId: string, modeId: string): number {
    checkAndRotateDay()
    const now = new Date().toISOString()
    run(
      'INSERT INTO usage_logs (user_id, mode_id, started_at) VALUES (?, ?, ?)',
      [userId, modeId, now],
    )
    const result = query('SELECT last_insert_rowid() as id FROM usage_logs') as any[]
    return result[0]?.id ?? 0
  },

  /**
   * End a usage session, recording duration.
   */
  endSession(sessionId: number): void {
    if (!sessionId) return
    const now = new Date().toISOString()
    const started = (query('SELECT started_at FROM usage_logs WHERE id = ?', [sessionId]) as any[])[0]
    if (!started) return
    const durationSec = Math.max(0, Math.floor((Date.now() - new Date(started.started_at).getTime()) / 1000))
    run(
      'UPDATE usage_logs SET ended_at = ?, duration_seconds = ? WHERE id = ?',
      [now, durationSec, sessionId],
    )
  },

  /**
   * Get usage stats for a user (today only, local timezone).
   * Pass modeId='all' to get totals across all modes.
   */
  getStats(userId: string, modeId: string, isGuest: boolean): UsageStats {
    checkAndRotateDay()
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    let modeUsageCount = 0
    if (modeId && modeId !== 'all') {
      const modeRows = query(
        `SELECT COUNT(*) as count FROM usage_logs
         WHERE user_id = ? AND mode_id = ? AND date(started_at) = ?`,
        [userId, modeId, todayStr],
      ) as any[]
      modeUsageCount = modeRows[0]?.count ?? 0
    }

    const totalRows = query(
      `SELECT COALESCE(SUM(duration_seconds), 0) as total
       FROM usage_logs
       WHERE user_id = ? AND date(started_at) = ?`,
      [userId, todayStr],
    ) as any[]
    const totalSecondsToday = totalRows[0]?.total ?? 0
    const totalMinutesUsed = Math.floor(totalSecondsToday / 60)
    const totalMinutesRemaining = Math.max(0, GUEST_DAILY_MINUTES - totalMinutesUsed)

    return {
      modeUsageCount,
      modeUsageRemaining: isGuest ? Math.max(0, GUEST_MODE_LIMIT - modeUsageCount) : Infinity,
      totalSecondsToday,
      totalMinutesRemaining: isGuest ? totalMinutesRemaining : Infinity,
      isGuest,
    }
  },

  /**
   * Check if user can start a new session in this mode.
   * Registered users always get { allowed: true }.
   */
  checkLimit(userId: string, modeId: string, isGuest: boolean): {
    allowed: boolean
    reason?: 'mode_limit' | 'time_limit'
    stats: UsageStats
  } {
    if (!isGuest) {
      return {
        allowed: true,
        stats: this.getStats(userId, modeId, isGuest),
      }
    }
    const stats = this.getStats(userId, modeId, isGuest)

    if (modeId !== 'all' && stats.modeUsageCount >= GUEST_MODE_LIMIT) {
      return { allowed: false, reason: 'mode_limit', stats }
    }
    if (stats.totalMinutesRemaining <= 0) {
      return { allowed: false, reason: 'time_limit', stats }
    }
    return { allowed: true, stats }
  },
}
