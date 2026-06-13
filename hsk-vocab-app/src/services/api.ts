import { Word, UserProgress, StudySession, UserProfile, LeaderboardEntry, DailyStats, HSKLevel } from '@/types'
import { supabase, isSupabaseConfigured } from './supabase'
import { getLocalStorage, setLocalStorage } from '@/utils/localStorage'

export const wordService = {
  async getAll(): Promise<Word[]> {
    if (!isSupabaseConfigured()) {
      return getLocalStorage<Word[]>('hsk_words', [])
    }
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .order('hsk_level')
    if (error) throw error
    return (data || []).map((w: any) => ({
      ...w,
      id: String(w.id),
      pos: Array.isArray(w.pos) ? w.pos : [],
      pos_raw: w.pos_raw || '',
      english: w.english || '',
    }))
  },

  async getByLevel(level: HSKLevel): Promise<Word[]> {
    if (!isSupabaseConfigured()) {
      const words = getLocalStorage<Word[]>('hsk_words', [])
      return words.filter(w => w.hsk_level === level)
    }
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('hsk_level', level)
    if (error) throw error
    return (data || []).map((w: any) => ({
      ...w,
      id: String(w.id),
      pos: Array.isArray(w.pos) ? w.pos : [],
      pos_raw: w.pos_raw || '',
      english: w.english || '',
    }))
  },

  async search(query: string): Promise<Word[]> {
    if (!isSupabaseConfigured()) {
      const words = getLocalStorage<Word[]>('hsk_words', [])
      const q = query.toLowerCase()
      return words.filter(
        w =>
          w.chinese.includes(q) ||
          w.pinyin.toLowerCase().includes(q) ||
          w.english.toLowerCase().includes(q)
      )
    }
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .or(`chinese.ilike.%${query}%,pinyin.ilike.%${query}%,english.ilike.%${query}%`)
    if (error) throw error
    return (data || []).map((w: any) => ({
      ...w,
      id: String(w.id),
      pos: Array.isArray(w.pos) ? w.pos : [],
      pos_raw: w.pos_raw || '',
      english: w.english || '',
    }))
  },
}

export const progressService = {
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    if (!isSupabaseConfigured()) {
      return getLocalStorage<UserProgress[]>(`progress_${userId}`, [])
    }
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    return data || []
  },

  async updateProgress(progress: Partial<UserProgress> & { word_id: string }, userId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      const allProgress = getLocalStorage<UserProgress[]>(`progress_${userId}`, [])
      const idx = allProgress.findIndex(p => p.word_id === progress.word_id)
      if (idx >= 0) {
        allProgress[idx] = { ...allProgress[idx], ...progress } as UserProgress
      } else {
        allProgress.push({
          id: crypto.randomUUID(),
          user_id: userId,
          mastery_level: 0,
          last_reviewed: new Date().toISOString(),
          next_review: new Date().toISOString(),
          review_count: 0,
          correct_count: 0,
          easiness_factor: 2.5,
          interval: 1,
          ...progress,
        } as UserProgress)
      }
      setLocalStorage(`progress_${userId}`, allProgress)
      return
    }
    const { error } = await supabase
      .from('user_progress')
      .upsert({
        ...progress,
        user_id: userId,
        last_reviewed: new Date().toISOString(),
      })
    if (error) throw error
  },

  async getDueReviews(userId: string): Promise<UserProgress[]> {
    const allProgress = await this.getUserProgress(userId)
    const now = new Date().toISOString()
    return allProgress.filter(p => p.next_review <= now)
  },
}

export const sessionService = {
  async recordSession(session: Omit<StudySession, 'id' | 'date'>): Promise<void> {
    if (!isSupabaseConfigured()) {
      const sessions = getLocalStorage<StudySession[]>('study_sessions', [])
      sessions.push({
        ...session,
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
      } as StudySession)
      setLocalStorage('study_sessions', sessions)
      return
    }
    const { error } = await supabase.from('study_sessions').insert({
      ...session,
      date: new Date().toISOString(),
    })
    if (error) throw error
  },

  async getStats(userId: string, days: number = 30): Promise<DailyStats[]> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    
    if (!isSupabaseConfigured()) {
      const sessions = getLocalStorage<StudySession[]>('study_sessions', [])
      return sessions
        .filter(s => new Date(s.date) >= cutoff)
        .map(s => ({
          date: s.date,
          words_studied: s.words_studied,
          accuracy: s.accuracy,
          duration: s.duration,
        }))
    }
    const { data, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', cutoff.toISOString())
    if (error) throw error
    return (data || []).map(s => ({
      date: s.date,
      words_studied: s.words_studied,
      accuracy: s.accuracy,
      duration: s.duration,
    }))
  },
}

export const authService = {
  async signUp(email: string, password: string, username: string): Promise<UserProfile> {
    if (!isSupabaseConfigured()) {
      const profile: UserProfile = {
        id: crypto.randomUUID(),
        email,
        username,
        avatar_url: '',
        daily_goal: 20,
        streak_count: 0,
        last_study_date: '',
        created_at: new Date().toISOString(),
      }
      setLocalStorage('user_profile', profile)
      return profile
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) throw error
    return {
      id: data.user?.id || '',
      email: data.user?.email || email,
      username,
      avatar_url: '',
      daily_goal: 20,
      streak_count: 0,
      last_study_date: '',
      created_at: new Date().toISOString(),
    }
  },

  async signIn(email: string, password: string): Promise<UserProfile> {
    if (!isSupabaseConfigured()) {
      const profile = getLocalStorage<UserProfile | null>('user_profile', null)
      if (profile && profile.email === email) {
        return profile
      }
      throw new Error('Guest mode: No account found')
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return {
      id: data.user?.id || '',
      email: data.user?.email || email,
      username: data.user?.user_metadata?.username || email.split('@')[0],
      avatar_url: '',
      daily_goal: 20,
      streak_count: 0,
      last_study_date: '',
      created_at: new Date().toISOString(),
    }
  },

  async signInWithGoogle(): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured')
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
  },

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured()) {
      setLocalStorage('user_profile', null)
      return
    }
    await supabase.auth.signOut()
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured()) {
      return getLocalStorage<UserProfile | null>('user_profile', null)
    }
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    return {
      id: data.user.id,
      email: data.user.email || '',
      username: data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'User',
      avatar_url: '',
      daily_goal: 20,
      streak_count: 0,
      last_study_date: '',
      created_at: new Date().toISOString(),
    }
  },

  getGuestId(): string {
    let guestId = localStorage.getItem('guest_id')
    if (!guestId) {
      guestId = crypto.randomUUID()
      localStorage.setItem('guest_id', guestId)
    }
    return guestId
  },
}

export const leaderboardService = {
  async getTop(mode: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    if (!isSupabaseConfigured()) {
      return getLocalStorage<LeaderboardEntry[]>(`leaderboard_${mode}`, [])
    }
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('mode', mode)
      .order('score', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  },

  async addEntry(entry: Omit<LeaderboardEntry, 'id'>): Promise<void> {
    if (!isSupabaseConfigured()) {
      const entries = getLocalStorage<LeaderboardEntry[]>(`leaderboard_${entry.mode}`, [])
      entries.push({ ...entry, id: crypto.randomUUID() } as LeaderboardEntry)
      entries.sort((a, b) => b.score - a.score)
      setLocalStorage(`leaderboard_${entry.mode}`, entries.slice(0, 100))
      return
    }
    const { error } = await supabase.from('leaderboard').insert(entry)
    if (error) throw error
  },
}