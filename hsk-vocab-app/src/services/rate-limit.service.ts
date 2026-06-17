import { query, run, ensureDb } from './database'

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

// Guard against queries firing before the database has finished
// initializing, or against older saved databases that somehow don't
// have the usage_logs table yet. Both are rare, but they're easy to
// handle defensively and the page crash they cause is very visible.
function safeQuery(sql: string, params: any[] = []): any[] {
  try {
    return query(sql, params) as any[]
  } catch (e) {
    console.warn('rateLimitService query failed (will retry on next call):', e)
    return []
  }
}

async function ensureReady(): Promise<void> {
  try {
    await ensureDb()
  } catch {
    /* DB still initializing — caller will get an empty stats object */
  }
}

export const rateLimitService = {
  /**
   * Start a usage session. Returns session id to use with endSession().
   */
  async startSession(userId: string, modeId: string): Promise<number> {
    await ensureReady()
    checkAndRotateDay()
    const now = new Date().toISOString()
    run(
      'INSERT INTO usage_logs (user_id, mode_id, started_at) VALUES (?, ?, ?)',
      [userId, modeId, now],
    )
    const result = safeQuery('SELECT last_insert_rowid() as id FROM usage_logs')
    return result[0]?.id ?? 0
  },

  /**
   * End a usage session, recording duration.
   */
  async endSession(sessionId: number): Promise<void> {
    if (!sessionId) return
    await ensureReady()
    const now = new Date().toISOString()
    const started = safeQuery('SELECT started_at FROM usage_logs WHERE id = ?', [sessionId])[0]
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
  async getStats(userId: string, modeId: string, isGuest: boolean): Promise<UsageStats> {
    await ensureReady()
    checkAndRotateDay()
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    let modeUsageCount = 0
    if (modeId && modeId !== 'all') {
      const modeRows = safeQuery(
        `SELECT COUNT(*) as count FROM usage_logs
         WHERE user_id = ? AND mode_id = ? AND date(started_at) = ?`,
        [userId, modeId, todayStr],
      )
      modeUsageCount = modeRows[0]?.count ?? 0
    }

    const totalRows = safeQuery(
      `SELECT COALESCE(SUM(duration_seconds), 0) as total
       FROM usage_logs
       WHERE user_id = ? AND date(started_at) = ?`,
      [userId, todayStr],
    )
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
  async checkLimit(userId: string, modeId: string, isGuest: boolean): Promise<{
    allowed: boolean
    reason?: 'mode_limit' | 'time_limit'
    stats: UsageStats
  }> {
    const stats = await this.getStats(userId, modeId, isGuest)

    if (!isGuest) {
      return { allowed: true, stats }
    }
    if (modeId !== 'all' && stats.modeUsageCount >= GUEST_MODE_LIMIT) {
      return { allowed: false, reason: 'mode_limit', stats }
    }
    if (stats.totalMinutesRemaining <= 0) {
      return { allowed: false, reason: 'time_limit', stats }
    }
    return { allowed: true, stats }
  },
}
