import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Optional sync of usage logs to Supabase so signed-in users keep their quota
 * across devices. Local SQLite remains the source of truth — this is a
 * soft mirror for cross-device analytics only.
 *
 * When Supabase env vars are not set, all methods are no-ops.
 */
export const rateLimitSync = {
  async syncSession(
    userId: string,
    modeId: string,
    durationSec: number,
    startedAt: string,
  ): Promise<void> {
    if (!isSupabaseConfigured() || userId.startsWith('guest-')) return
    try {
      await supabase.from('usage_logs').upsert(
        {
          user_id: userId,
          mode_id: modeId,
          duration_seconds: durationSec,
          started_at: startedAt,
        },
        { onConflict: 'user_id,mode_id,started_at' },
      )
    } catch (e) {
      console.warn('[usage-sync] failed', e)
    }
  },

  async getRemoteTodayCount(userId: string, modeId: string): Promise<number> {
    if (!isSupabaseConfigured() || userId.startsWith('guest-')) return 0
    try {
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('mode_id', modeId)
        .gte('started_at', `${today}T00:00:00Z`)
      return count ?? 0
    } catch {
      return 0
    }
  },
}
