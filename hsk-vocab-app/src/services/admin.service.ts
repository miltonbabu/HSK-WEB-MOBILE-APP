import { ensureDb, query, run, clearSavedDb } from './database'
import {
  supabase, isDevelopment, isSupabaseConfigured,
  createMockAdminJWT, parseTokenPayload, hashPassword,
  getStoredAdminToken, setStoredAdminToken, clearStoredAdminToken,
} from './supabase'
import { UserProfile } from '@/types'
import { clearUserChat, clearAllChat, getChatStorageSize } from './ai-chat'

export const SUPER_ADMIN_EMAIL = 'miltonbabu9666@gmail.com'

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return String(email).toLowerCase() === SUPER_ADMIN_EMAIL
}

export interface AdminUser {
  id: string
  email: string
  username: string
}

export interface AdminStats {
  totalUsers: number
  totalWords: number
  totalSessions: number
  wordsByLevel: { level: number; count: number }[]
  recentUsers: { id: string; username: string; email: string; created_at: string }[]
  recentSessions: { id: string; username: string; mode: string; words_studied: number; date: string }[]
  topUsers: { id: string; username: string; streak_count: number; total_reviews: number }[]
  totalProgress: number
}

export interface VocabularyWord {
  id: string
  hsk_level: number
  chinese: string
  pinyin: string
  english: string
  pos: string
  example_sentences: string
  topic_category: string
  created_at: string
}

export interface SystemSettings {
  guestDailyLimit: number
  defaultDailyGoal: number
  signupEnabled: boolean
  aiChatEnabled: boolean
  siteName: string
  description: string
}

export interface VisitorStats {
  today: number
  thisWeek: number
  thisMonth: number
}

export interface VisitorTrendItem {
  date: string
  count: number
}

const SETTINGS_KEY = 'hsk-admin-settings'

const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 1

function checkRateLimit(identifier: string): void {
  const now = Date.now()
  const entry = loginAttempts.get(identifier)

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      const waitSec = Math.ceil((entry.resetAt - now) / 1000)
      throw new Error(`Too many login attempts. Please wait ${waitSec} seconds.`)
    }
  }

  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(identifier, { count: 1, resetAt: now + LOCKOUT_MINUTES * 60 * 1000 })
  } else {
    loginAttempts.set(identifier, { count: entry.count + 1, resetAt: entry.resetAt })
  }
}

export const adminService = {
  async login(email: string, _password: string): Promise<{ admin: AdminUser; token: string }> {
    await ensureDb()
    checkRateLimit(email)

    // Local SQLite path is used when we are in dev mode OR Supabase isn't wired.
    if (isDevelopment || !isSupabaseConfigured()) {
      const results = query('SELECT * FROM user_profiles WHERE email = ? AND is_admin = 1', [email])
      if (results.length === 0) {
        throw new Error('Invalid admin credentials')
      }

      // Always require a password_hash on the admin row. Passwordless
      // admins are a critical security hole — reject them.
      const stored = results[0].password_hash
      if (!stored || typeof stored !== 'string' || stored.length === 0) {
        throw new Error('Password not set — admin must reset password')
      }

      const { hashPassword } = await import('./supabase')
      const hashed = await hashPassword(_password)
      if (stored !== hashed) {
        throw new Error('Invalid admin credentials')
      }

      const user = results[0]
      const token = createMockAdminJWT({
        sub: String(user.id),
        email: user.email,
        username: user.username,
      })
      setStoredAdminToken(token)
      return { admin: { id: String(user.id), email: user.email, username: user.username }, token }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: _password })
    if (error) throw error

    // Verify this user is actually an admin in public.user_profiles
    const userId = data.user?.id
    if (!userId) throw new Error('Login failed')

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin, username')
      .eq('id', userId)
      .single()

    if (profileError || !profile || !(profile as any).is_admin) {
      try { await supabase.auth.signOut() } catch {}
      throw new Error('This account is not authorized for admin access')
    }

    const session = data.session
    if (session?.access_token) setStoredAdminToken(session.access_token)

    return {
      admin: { id: userId, email: data.user?.email || email, username: (profile as any).username || data.user?.user_metadata?.username || 'Admin' },
      token: session?.access_token || '',
    }
  },

  async logout(): Promise<void> {
    clearStoredAdminToken()
    if (isSupabaseConfigured()) {
      try { await supabase.auth.signOut() } catch { /* ignore */ }
    }
  },

  async checkAuth(): Promise<AdminUser | null> {
    const token = getStoredAdminToken()
    if (!token) return null

    const payload = parseTokenPayload(token)
    if (!payload) {
      clearStoredAdminToken()
      return null
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearStoredAdminToken()
      return null
    }

    const uid = payload.sub
    if (!uid) {
      clearStoredAdminToken()
      return null
    }

    // Always verify the user is actually an admin against the source of
    // truth (Supabase or local SQLite). NEVER trust the token body's
    // `role: 'admin'` claim alone — it's unsigned and a user can craft
    // a token with that field to bypass admin auth.
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, email, username, is_admin')
          .eq('id', uid)
          .single()
        if (error || !data || !(data as any).is_admin) {
          clearStoredAdminToken()
          return null
        }
        return {
          id: String((data as any).id),
          email: (data as any).email || payload.email || '',
          username: (data as any).username || payload.username || 'Admin',
        }
      } catch {
        clearStoredAdminToken()
        return null
      }
    }

    // Local SQLite path
    try {
      await ensureDb()
      const results = query('SELECT id, email, username, is_admin FROM user_profiles WHERE id = ?', [uid])
      if (results.length === 0 || !results[0].is_admin) {
        clearStoredAdminToken()
        return null
      }
      const r = results[0]
      return {
        id: String(r.id),
        email: r.email || payload.email || '',
        username: r.username || payload.username || 'Admin',
      }
    } catch {
      clearStoredAdminToken()
      return null
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { data, error } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({ ...r, id: String(r.id) }))
    }
    await ensureDb()
    const results = query('SELECT * FROM user_profiles ORDER BY created_at DESC')
    return results.map((r: any) => ({ ...r, id: String(r.id) }))
  },

  async getUserById(id: string): Promise<UserProfile | null> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('id', id).single()
      if (error) { if (error.code === 'PGRST116') return null; throw error }
      return { ...data, id: String(data.id) } as UserProfile
    }
    await ensureDb()
    const results = query('SELECT * FROM user_profiles WHERE id = ?', [id])
    if (results.length === 0) return null
    const r = results[0]
    return { ...r, id: String(r.id) }
  },

  async deleteUser(id: string): Promise<void> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { data: target } = await supabase.from('user_profiles').select('email').eq('id', id).single()
      if (target && isSuperAdminEmail((target as any).email)) throw new Error('Super Admin cannot be deleted')
      const { error } = await supabase.from('user_profiles').update({ is_active: false }).eq('id', id)
      if (error) throw error
      return
    }
    await ensureDb()
    const existing = query('SELECT email FROM user_profiles WHERE id = ?', [id])
    if (existing.length > 0 && isSuperAdminEmail(existing[0].email)) {
      throw new Error('Super Admin cannot be deleted')
    }
    run('UPDATE user_profiles SET is_active = 0 WHERE id = ?', [id])
  },

  async restoreUser(id: string): Promise<void> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { error } = await supabase.from('user_profiles').update({ is_active: true }).eq('id', id)
      if (error) throw error
      return
    }
    await ensureDb()
    run('UPDATE user_profiles SET is_active = 1 WHERE id = ?', [id])
  },

  async hardDeleteUser(id: string): Promise<void> {
    // Protect super admin
    if (!isDevelopment || isSupabaseConfigured()) {
      const { data: existing } = await supabase.from('user_profiles').select('email').eq('id', id).single()
      if (existing && (existing as any).email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
        throw new Error('Super Admin cannot be deleted')
      }
      clearUserChat(String(id))
      await supabase.from('user_progress').delete().eq('user_id', id)
      await supabase.from('study_sessions').delete().eq('user_id', id)
      await supabase.from('leaderboard').delete().eq('user_id', id)
      const { error } = await supabase.from('user_profiles').delete().eq('id', id)
      if (error) throw error
      return
    }
    await ensureDb()
    const existing = query('SELECT email FROM user_profiles WHERE id = ?', [id])
    if (existing.length > 0 && existing[0].email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
      throw new Error('Super Admin cannot be deleted')
    }
    clearUserChat(String(id))
    run('DELETE FROM user_profiles WHERE id = ?', [id])
    run('DELETE FROM user_progress WHERE user_id = ?', [id])
    run('DELETE FROM study_sessions WHERE user_id = ?', [id])
    run('DELETE FROM leaderboard WHERE user_id = ?', [id])
  },

  async clearUserData(id: string): Promise<{ progressRows: number; sessionRows: number; leaderboardRows: number; chatSessions: number }> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { count: progressBefore } = await supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('user_id', id)
      const { count: sessionBefore } = await supabase.from('study_sessions').select('*', { count: 'exact', head: true }).eq('user_id', id)
      const { count: leaderboardBefore } = await supabase.from('leaderboard').select('*', { count: 'exact', head: true }).eq('user_id', id)
      await supabase.from('user_progress').delete().eq('user_id', id)
      await supabase.from('study_sessions').delete().eq('user_id', id)
      await supabase.from('leaderboard').delete().eq('user_id', id)
      await supabase.from('user_profiles').update({ streak_count: 0, last_study_date: null }).eq('id', id)
      const chatSessions = clearUserChat(String(id))
      return { progressRows: progressBefore || 0, sessionRows: sessionBefore || 0, leaderboardRows: leaderboardBefore || 0, chatSessions }
    }
    await ensureDb()
    const progressBefore = (query('SELECT COUNT(*) as count FROM user_progress WHERE user_id = ?', [id])[0] as any)?.count || 0
    const sessionBefore = (query('SELECT COUNT(*) as count FROM study_sessions WHERE user_id = ?', [id])[0] as any)?.count || 0
    const leaderboardBefore = (query('SELECT COUNT(*) as count FROM leaderboard WHERE user_id = ?', [id])[0] as any)?.count || 0

    run('DELETE FROM user_progress WHERE user_id = ?', [id])
    run('DELETE FROM study_sessions WHERE user_id = ?', [id])
    run('DELETE FROM leaderboard WHERE user_id = ?', [id])
    run('UPDATE user_profiles SET streak_count = 0, last_study_date = NULL WHERE id = ?', [id])
    const chatSessions = clearUserChat(String(id))

    return {
      progressRows: progressBefore,
      sessionRows: sessionBefore,
      leaderboardRows: leaderboardBefore,
      chatSessions,
    }
  },

  async clearAllUsersData(): Promise<{ progressRows: number; sessionRows: number; leaderboardRows: number; chatMessages: number }> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { count: progressBefore } = await supabase.from('user_progress').select('*', { count: 'exact', head: true })
      const { count: sessionBefore } = await supabase.from('study_sessions').select('*', { count: 'exact', head: true })
      const { count: leaderboardBefore } = await supabase.from('leaderboard').select('*', { count: 'exact', head: true })
      const chatMessages = clearAllChat()
      await supabase.from('user_progress').delete().neq('id', 0)
      await supabase.from('study_sessions').delete().neq('id', 0)
      await supabase.from('leaderboard').delete().neq('id', 0)
      await supabase.from('user_profiles').update({ streak_count: 0, last_study_date: null }).neq('id', '')
      return { progressRows: progressBefore || 0, sessionRows: sessionBefore || 0, leaderboardRows: leaderboardBefore || 0, chatMessages }
    }
    await ensureDb()
    const progressBefore = (query('SELECT COUNT(*) as count FROM user_progress')[0] as any)?.count || 0
    const sessionBefore = (query('SELECT COUNT(*) as count FROM study_sessions')[0] as any)?.count || 0
    const leaderboardBefore = (query('SELECT COUNT(*) as count FROM leaderboard')[0] as any)?.count || 0
    const chatMessages = clearAllChat()

    run('DELETE FROM user_progress')
    run('DELETE FROM study_sessions')
    run('DELETE FROM leaderboard')
    run('UPDATE user_profiles SET streak_count = 0, last_study_date = NULL')

    return {
      progressRows: progressBefore,
      sessionRows: sessionBefore,
      leaderboardRows: leaderboardBefore,
      chatMessages,
    }
  },

  async getStorageStats(): Promise<{
    users: number
    activeUsers: number
    learningRecords: number
    studySessions: number
    leaderboardEntries: number
    chatSessions: number
    chatMessages: number
    chatSizeBytes: number
  }> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { count: users } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true })
      const { count: activeUsers } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true)
      const { count: learningRecords } = await supabase.from('user_progress').select('*', { count: 'exact', head: true })
      const { count: studySessions } = await supabase.from('study_sessions').select('*', { count: 'exact', head: true })
      const { count: leaderboardEntries } = await supabase.from('leaderboard').select('*', { count: 'exact', head: true })
      const chat = getChatStorageSize()
      return { users: users || 0, activeUsers: activeUsers || 0, learningRecords: learningRecords || 0, studySessions: studySessions || 0, leaderboardEntries: leaderboardEntries || 0, chatSessions: chat.sessions, chatMessages: chat.messages, chatSizeBytes: chat.sizeBytes }
    }
    await ensureDb()
    const users = (query('SELECT COUNT(*) as count FROM user_profiles')[0] as any)?.count || 0
    const activeUsers = (query('SELECT COUNT(*) as count FROM user_profiles WHERE is_active = 1')[0] as any)?.count || 0
    const learningRecords = (query('SELECT COUNT(*) as count FROM user_progress')[0] as any)?.count || 0
    const studySessions = (query('SELECT COUNT(*) as count FROM study_sessions')[0] as any)?.count || 0
    const leaderboardEntries = (query('SELECT COUNT(*) as count FROM leaderboard')[0] as any)?.count || 0
    const chat = getChatStorageSize()
    return { users, activeUsers, learningRecords, studySessions, leaderboardEntries, chatSessions: chat.sessions, chatMessages: chat.messages, chatSizeBytes: chat.sizeBytes }
  },

  async updateUser(id: string, updates: { username?: string; email?: string; is_admin?: boolean; password?: string }): Promise<void> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { data: target } = await supabase.from('user_profiles').select('email').eq('id', id).single()
      if (target && isSuperAdminEmail((target as any).email)) {
        if (updates.email !== undefined && !isSuperAdminEmail(updates.email)) throw new Error('Super Admin email cannot be changed')
        if (updates.is_admin === false) throw new Error('Super Admin role cannot be removed')
      }
      const payload: Record<string, any> = {}
      if (updates.username !== undefined) payload.username = updates.username
      if (updates.email !== undefined) payload.email = updates.email
      if (updates.is_admin !== undefined) payload.is_admin = updates.is_admin
      if (updates.password && updates.password.trim().length > 0) {
        const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password: updates.password.trim() })
        if (pwError) throw pwError
      }
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from('user_profiles').update(payload).eq('id', id)
        if (error) throw error
      }
      return
    }
    await ensureDb()
    const existing = query('SELECT email FROM user_profiles WHERE id = ?', [id])
    if (existing.length > 0 && isSuperAdminEmail(existing[0].email)) {
      if (updates.email?.toLowerCase() !== SUPER_ADMIN_EMAIL && updates.email !== undefined) {
        throw new Error('Super Admin email cannot be changed')
      }
      if (updates.is_admin === false) {
        throw new Error('Super Admin role cannot be removed')
      }
    }
    const isAdminParam = updates.is_admin === true ? 1 : (updates.is_admin === false ? 0 : null)
    let passwordHash: string | null = null
    if (updates.password && updates.password.trim().length > 0) {
      passwordHash = await hashPassword(updates.password.trim())
    }
    run('UPDATE user_profiles SET username = COALESCE(?, username), email = COALESCE(?, email), is_admin = COALESCE(?, is_admin), password_hash = COALESCE(?, password_hash) WHERE id = ?', [
      updates.username || null,
      updates.email || null,
      isAdminParam,
      passwordHash,
      id,
    ])
  },

  async createUser(user: { username: string; email: string; password: string; is_admin?: boolean }): Promise<string> {
    if (!user.username || !user.username.trim()) throw new Error('Username is required')
    if (!user.email || !user.email.trim()) throw new Error('Email is required')
    if (!user.password || user.password.length < 4) throw new Error('Password must be at least 4 characters')

    if (!isDevelopment || isSupabaseConfigured()) {
      const { data, error } = await supabase.auth.signUp({
        email: user.email.trim(),
        password: user.password,
        options: { data: { username: user.username.trim() } },
      })
      if (error) {
        if (error.message?.includes('already') || error.code === 'user_already_exists') throw new Error('A user with this email already exists')
        throw error
      }
      if (!data.user) throw new Error('Failed to create user')
      await supabase.from('user_profiles').insert({
        id: data.user.id,
        email: user.email.trim(),
        username: user.username.trim(),
        is_admin: user.is_admin ? true : false,
        is_active: true,
        daily_goal: 20,
        streak_count: 0,
      })
      return data.user.id
    }

    await ensureDb()
    const existing = query('SELECT id FROM user_profiles WHERE LOWER(email) = ?', [user.email.toLowerCase().trim()])
    if (existing.length > 0) throw new Error('A user with this email already exists')

    const passwordHash = await hashPassword(user.password.trim())
    run(`INSERT INTO user_profiles (username, email, password_hash, is_admin, is_active, daily_goal, streak_count, created_at)
         VALUES (?, ?, ?, ?, 1, 20, 0, CURRENT_TIMESTAMP)`, [
      user.username.trim(),
      user.email.trim(),
      passwordHash,
      user.is_admin ? 1 : 0,
    ])
    const lastId = query('SELECT last_insert_rowid() as id')[0]
    return String(lastId?.id || '')
  },

  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 4) throw new Error('Password must be at least 4 characters')
    if (!isDevelopment || isSupabaseConfigured()) {
      const { error } = await supabase.auth.admin.updateUserById(id, { password: newPassword })
      if (error) throw error
      return
    }
    await ensureDb()
    const passwordHash = await hashPassword(newPassword.trim())
    run('UPDATE user_profiles SET password_hash = ? WHERE id = ?', [passwordHash, id])
  },

  async getStats(): Promise<AdminStats> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { count: totalUsers } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true })
      const { count: totalWords } = await supabase.from('words').select('*', { count: 'exact', head: true })
      const { count: totalSessions } = await supabase.from('study_sessions').select('*', { count: 'exact', head: true })
      const { data: byLevel } = await supabase.rpc('count_words_by_level')
      const { count: totalProgress } = await supabase.from('user_progress').select('*', { count: 'exact', head: true }).gt('mastery_level', 0)
      const { data: recentUsers } = await supabase.from('user_profiles').select('id, username, email, created_at').order('created_at', { ascending: false }).limit(5)
      // Fetch sessions and usernames separately — the Supabase join syntax
      // user_profiles(username) requires a FK relationship that isn't defined
      // in the schema, which causes a 400 error.
      const { data: recentSessionsRaw } = await supabase.from('study_sessions').select('id, user_id, mode, words_studied, date').order('date', { ascending: false }).limit(10)
      const sessionUserIds = [...new Set((recentSessionsRaw ?? []).map((s: any) => s.user_id).filter(Boolean))]
      const { data: sessionUsers } = sessionUserIds.length > 0
        ? await supabase.from('user_profiles').select('id, username').in('id', sessionUserIds as any)
        : { data: [] }
      const userMap = new Map((sessionUsers ?? []).map((u: any) => [String(u.id), u.username || 'Unknown']))
      const { data: topUsers } = await supabase.from('user_profiles').select('id, username, streak_count').order('streak_count', { ascending: false }).limit(5)
      return {
        totalUsers: totalUsers || 0,
        totalWords: totalWords || 0,
        totalSessions: totalSessions || 0,
        wordsByLevel: (byLevel ?? []).map((r: any) => ({ level: r.hsk_level, count: Number(r.count) })),
        recentUsers: (recentUsers ?? []).map((r: any) => ({ ...r, id: String(r.id), created_at: r.created_at || '' })),
        recentSessions: (recentSessionsRaw ?? []).map((r: any) => ({ id: String(r.id), username: userMap.get(String(r.user_id)) || 'Unknown', mode: r.mode, words_studied: r.words_studied, date: r.date })),
        topUsers: (topUsers ?? []).map((r: any) => ({ ...r, id: String(r.id), total_reviews: 0 })),
        totalProgress: totalProgress || 0,
      }
    }
    await ensureDb()
    const totalUsers = (query('SELECT COUNT(*) as count FROM user_profiles')[0] as any)?.count || 0
    const totalWords = (query('SELECT COUNT(*) as count FROM words')[0] as any)?.count || 0
    const totalSessions = (query('SELECT COUNT(*) as count FROM study_sessions')[0] as any)?.count || 0
    const byLevel = query('SELECT hsk_level as level, COUNT(*) as count FROM words GROUP BY hsk_level ORDER BY hsk_level') as any[]
    const totalProgress = (query('SELECT COUNT(*) as count FROM user_progress WHERE mastery_level > 0')[0] as any)?.count || 0

    const recentUsers = query('SELECT id, username, email, created_at FROM user_profiles ORDER BY created_at DESC LIMIT 5').map((r: any) => ({ ...r, id: String(r.id) }))

    const recentSessions = query(`
      SELECT s.id, s.mode, s.words_studied, s.date, u.username
      FROM study_sessions s
      LEFT JOIN user_profiles u ON s.user_id = u.id
      ORDER BY s.date DESC
      LIMIT 10
    `).map((r: any) => ({ ...r, id: String(r.id), username: r.username || 'Unknown' }))

    const topUsers = query(`
      SELECT u.id, u.username, u.streak_count,
        (SELECT COUNT(*) FROM user_progress p WHERE p.user_id = u.id) as total_reviews
      FROM user_profiles u
      ORDER BY u.streak_count DESC
      LIMIT 5
    `).map((r: any) => ({ ...r, id: String(r.id) }))

    return { totalUsers, totalWords, totalSessions, wordsByLevel: byLevel || [], recentUsers, recentSessions, topUsers, totalProgress }
  },

  async getVocabulary(level?: number, search?: string, page: number = 1, pageSize: number = 25): Promise<{ words: VocabularyWord[]; total: number }> {
    if (!isDevelopment || isSupabaseConfigured()) {
      let builder = supabase.from('words').select('*', { count: 'exact' })
      if (level) builder = builder.eq('hsk_level', level)
      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`
        builder = builder.or(`chinese.ilike.${q},pinyin.ilike.${q},english.ilike.${q}`)
      }
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, count, error } = await builder.order('hsk_level').order('chinese').range(from, to)
      if (error) throw error
      return { words: (data ?? []).map((r: any) => ({ ...r, id: String(r.id) })), total: count || 0 }
    }
    await ensureDb()

    let where: string[] = []
    let params: any[] = []

    if (level) {
      where.push('w.hsk_level = ?')
      params.push(level)
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`
      where.push('(LOWER(w.chinese) LIKE ? OR LOWER(w.pinyin) LIKE ? OR LOWER(w.english) LIKE ?)')
      params.push(term, term, term)
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''

    const totalResult = query(`SELECT COUNT(*) as count FROM words w ${whereClause}`, params)
    const total = (totalResult[0] as any)?.count || 0

    const offset = (page - 1) * pageSize
    const words = query(`
      SELECT w.id, w.hsk_level, w.chinese, w.pinyin, w.english, w.pos, w.example_sentences, w.topic_category, w.created_at
      FROM words w
      ${whereClause}
      ORDER BY w.hsk_level, w.chinese
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]).map((r: any) => ({ ...r, id: String(r.id) }))

    return { words, total }
  },

  async getWord(id: string): Promise<VocabularyWord | null> {
    if (!isDevelopment || isSupabaseConfigured()) {
      const { data, error } = await supabase.from('words').select('*').eq('id', id).single()
      if (error) { if (error.code === 'PGRST116') return null; throw error }
      return { ...data, id: String(data.id) } as VocabularyWord
    }
    await ensureDb()
    const results = query('SELECT * FROM words WHERE id = ?', [parseInt(id)])
    if (results.length === 0) return null
    const r = results[0]
    return { ...r, id: String(r.id) }
  },

  async createWord(word: Partial<VocabularyWord>): Promise<string> {
    if (!word.chinese || !String(word.chinese).trim()) throw new Error('Chinese text is required')
    if (!word.pinyin || !String(word.pinyin).trim()) throw new Error('Pinyin is required')
    if (!word.english || !String(word.english).trim()) throw new Error('English meaning is required')
    if (word.hsk_level !== undefined && (word.hsk_level < 1 || word.hsk_level > 6)) {
      throw new Error('HSK level must be between 1 and 6')
    }
    if (!isDevelopment || isSupabaseConfigured()) {
      const { data, error } = await supabase.from('words').insert({
        hsk_level: word.hsk_level && word.hsk_level > 0 ? word.hsk_level : 1,
        chinese: String(word.chinese).trim(),
        pinyin: String(word.pinyin).trim(),
        english: String(word.english).trim(),
        pos: word.pos || '[]',
        example_sentences: word.example_sentences || '[]',
        topic_category: word.topic_category || 'general',
      }).select('id').single()
      if (error) throw error
      if (!data?.id) throw new Error('Failed to create word (no id returned)')
      return String(data.id)
    }
    await ensureDb()
    run(`
      INSERT INTO words (hsk_level, chinese, pinyin, english, pos, example_sentences, topic_category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      word.hsk_level && word.hsk_level > 0 ? word.hsk_level : 1,
      String(word.chinese).trim(),
      String(word.pinyin).trim(),
      String(word.english).trim(),
      word.pos || '[]',
      word.example_sentences || '[]',
      word.topic_category || 'general',
    ])
    const lastIdResults = query('SELECT last_insert_rowid() as id')
    const lastId = lastIdResults && lastIdResults[0]
    if (!lastId || !lastId.id) throw new Error('Failed to create word (no id returned)')
    return String(lastId.id)
  },

  async updateWord(id: string, updates: Partial<VocabularyWord>): Promise<void> {
    if (updates.hsk_level !== undefined && (updates.hsk_level < 1 || updates.hsk_level > 6)) {
      throw new Error('HSK level must be between 1 and 6')
    }
    if (!isDevelopment || isSupabaseConfigured()) {
      const payload: Record<string, any> = {}
      if (updates.hsk_level !== undefined && updates.hsk_level > 0) payload.hsk_level = updates.hsk_level
      if (updates.chinese !== undefined && String(updates.chinese).trim()) payload.chinese = String(updates.chinese).trim()
      if (updates.pinyin !== undefined && String(updates.pinyin).trim()) payload.pinyin = String(updates.pinyin).trim()
      if (updates.english !== undefined && String(updates.english).trim()) payload.english = String(updates.english).trim()
      if (updates.pos !== undefined) payload.pos = updates.pos
      if (updates.example_sentences !== undefined) payload.example_sentences = updates.example_sentences
      if (updates.topic_category !== undefined) payload.topic_category = updates.topic_category
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from('words').update(payload).eq('id', id)
        if (error) throw error
      }
      return
    }
    const numericId = parseInt(id)
    await ensureDb()

    const before = query('SELECT id FROM words WHERE id = ?', [numericId])
    if (before.length === 0) throw new Error('Word not found')

    const hskLevelParam = updates.hsk_level !== undefined && updates.hsk_level > 0 ? updates.hsk_level : null
    const chineseParam = updates.chinese !== undefined && String(updates.chinese).trim() ? String(updates.chinese).trim() : null
    const pinyinParam = updates.pinyin !== undefined && String(updates.pinyin).trim() ? String(updates.pinyin).trim() : null
    const englishParam = updates.english !== undefined && String(updates.english).trim() ? String(updates.english).trim() : null

    run(`
      UPDATE words SET
        hsk_level = COALESCE(?, hsk_level),
        chinese = COALESCE(?, chinese),
        pinyin = COALESCE(?, pinyin),
        english = COALESCE(?, english),
        pos = COALESCE(?, pos),
        example_sentences = COALESCE(?, example_sentences),
        topic_category = COALESCE(?, topic_category)
      WHERE id = ?
    `, [
      hskLevelParam,
      chineseParam,
      pinyinParam,
      englishParam,
      updates.pos !== undefined ? updates.pos : null,
      updates.example_sentences !== undefined ? updates.example_sentences : null,
      updates.topic_category !== undefined ? updates.topic_category : null,
      numericId,
    ])
  },

  async deleteWord(id: string): Promise<void> {
    if (!isDevelopment || isSupabaseConfigured()) {
      await supabase.from('user_progress').delete().eq('word_id', id)
      const { error } = await supabase.from('words').delete().eq('id', id)
      if (error) throw error
      return
    }
    const numericId = parseInt(id)
    await ensureDb()
    const existing = query('SELECT id FROM words WHERE id = ?', [numericId])
    if (existing.length === 0) throw new Error('Word not found')
    run('DELETE FROM user_progress WHERE word_id = ?', [numericId])
    run('DELETE FROM words WHERE id = ?', [numericId])
  },

  async deleteAllWords(): Promise<void> {
    if (!isDevelopment || isSupabaseConfigured()) {
      await supabase.from('user_progress').delete().neq('id', 0)
      await supabase.from('words').delete().neq('id', 0)
      return
    }
    await ensureDb()
    run('DELETE FROM words')
    run('DELETE FROM user_progress')
  },

  async getSettings(): Promise<SystemSettings> {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      try { return JSON.parse(raw) as SystemSettings } catch {}
    }
    return {
      guestDailyLimit: 10,
      defaultDailyGoal: 20,
      signupEnabled: true,
      aiChatEnabled: true,
      siteName: 'HSK Vocabulary',
      description: 'Learn Chinese vocabulary efficiently',
    }
  },

  async updateSettings(settings: SystemSettings): Promise<void> {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  },

  async resetDatabase(): Promise<void> {
    await ensureDb()
    run('DELETE FROM study_sessions')
    run('DELETE FROM user_progress')
    run('DELETE FROM leaderboard')
    run('UPDATE user_profiles SET streak_count = 0, last_study_date = NULL')
    clearAllChat()
    clearSavedDb() // Also clear the persisted database in localStorage
  },

  // ── Visitor Analytics ──

  async getVisitorStats(signal?: AbortSignal): Promise<VisitorStats> {
    // Server-side API route is the preferred path: it uses the Supabase
    // service-role key, which bypasses RLS so we always see the data
    // regardless of any anon-key policy. Falls back to the local
    // SQLite path if Supabase is not configured.
    if (isSupabaseConfigured() && !isDevelopment) {
      try {
        const token = getStoredAdminToken()
        const resp = await fetch(`/api/visitor/analytics?days=14`, {
          method: 'GET',
          signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (resp.ok) {
          const json = await resp.json()
          return json.stats || { today: 0, thisWeek: 0, thisMonth: 0 }
        }
        // 401/403/503 — fall through to direct Supabase path below
        if (resp.status === 401) {
          return { today: 0, thisWeek: 0, thisMonth: 0 }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) {
          return { today: 0, thisWeek: 0, thisMonth: 0 }
        }
        // fall through
      }
    }
    if (!isDevelopment || isSupabaseConfigured()) {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const weekAgo = new Date(now.getTime() - 6 * 86400000).toISOString().split('T')[0]
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

      if (signal?.aborted) return { today: 0, thisWeek: 0, thisMonth: 0 }

      try {
        const q = (b: any) => (signal ? b.abortSignal(signal) : b)
        const [todayRes, weekRes, monthRes] = await Promise.all([
          q(supabase.from('visitor_logs').select('*', { count: 'exact', head: true })).eq('visit_date', today),
          q(supabase.from('visitor_logs').select('*', { count: 'exact', head: true })).gte('visit_date', weekAgo),
          q(supabase.from('visitor_logs').select('*', { count: 'exact', head: true })).gte('visit_date', monthStart),
        ])

        return {
          today: todayRes.count || 0,
          thisWeek: weekRes.count || 0,
          thisMonth: monthRes.count || 0,
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) {
          return { today: 0, thisWeek: 0, thisMonth: 0 }
        }
        // Table may not exist yet — return zeros silently
        return { today: 0, thisWeek: 0, thisMonth: 0 }
      }
    }
    // SQLite fallback
    await ensureDb()
    run(`CREATE TABLE IF NOT EXISTS visitor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      first_visit_at TEXT NOT NULL,
      user_agent TEXT,
      is_guest INTEGER DEFAULT 1,
      UNIQUE(ip_hash, visit_date)
    )`)
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const t = query(`SELECT COUNT(*) as count FROM visitor_logs WHERE visit_date = ?`, [today])
    const w = query(`SELECT COUNT(*) as count FROM visitor_logs WHERE visit_date >= ?`, [weekAgo])
    const m = query(`SELECT COUNT(*) as count FROM visitor_logs WHERE visit_date >= ?`, [monthStart])
    return {
      today: t[0]?.count || 0,
      thisWeek: w[0]?.count || 0,
      thisMonth: m[0]?.count || 0,
    }
  },

  async getVisitorTrend(days: number, signal?: AbortSignal): Promise<VisitorTrendItem[]> {
    // Server-side API route preferred (RLS bypass via service role).
    if (isSupabaseConfigured() && !isDevelopment) {
      try {
        const token = getStoredAdminToken()
        const resp = await fetch(`/api/visitor/analytics?days=${days}`, {
          method: 'GET',
          signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (resp.ok) {
          const json = await resp.json()
          return json.trend || []
        }
        if (resp.status === 401) return []
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) return []
        // fall through
      }
    }
    const startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0]

    if (!isDevelopment || isSupabaseConfigured()) {
      if (signal?.aborted) return []
      try {
        let q = supabase
          .from('visitor_logs')
          .select('visit_date')
          .gte('visit_date', startDate)
          .order('visit_date', { ascending: true })
        if (signal) q = q.abortSignal(signal)

        const { data, error } = await q

        if (error || !data) return []

        // Group by date and count
        const counts = new Map<string, number>()
        for (const row of data) {
          const d = row.visit_date as string
          counts.set(d, (counts.get(d) || 0) + 1)
        }

        // Fill in missing days with 0
        const result: VisitorTrendItem[] = []
        for (let i = 0; i < days; i++) {
          const date = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0]
          result.push({ date, count: counts.get(date) || 0 })
        }
        return result
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) return []
        return []
      }
    }
    // SQLite fallback
    await ensureDb()
    run(`CREATE TABLE IF NOT EXISTS visitor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      first_visit_at TEXT NOT NULL,
      user_agent TEXT,
      is_guest INTEGER DEFAULT 1,
      UNIQUE(ip_hash, visit_date)
    )`)
    const rows = query(
      `SELECT visit_date, COUNT(*) as count FROM visitor_logs WHERE visit_date >= ? GROUP BY visit_date ORDER BY visit_date ASC`,
      [startDate]
    )
    const counts = new Map(rows.map(r => [r.visit_date, r.count]))
    const result: VisitorTrendItem[] = []
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0]
      result.push({ date, count: counts.get(date) || 0 })
    }
    return result
  },

  async deleteAllVisitorData(): Promise<void> {
    if (!isDevelopment || isSupabaseConfigured()) {
      try {
        await supabase.from('visitor_logs').delete().neq('id', 0)
      } catch {
        // Table may not exist yet — nothing to delete
      }
      return
    }
    await ensureDb()
    run(`CREATE TABLE IF NOT EXISTS visitor_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_hash TEXT, visit_date TEXT)`)
    run('DELETE FROM visitor_logs')
  },
}