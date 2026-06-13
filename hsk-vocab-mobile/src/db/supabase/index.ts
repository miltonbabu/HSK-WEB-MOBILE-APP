// Supabase implementation of DataSource.
// This file connects to the same Supabase project as the web app,
// so both apps share one database and auth system.
//
// When app.json -> expo.extra.dataSource is set to "supabase",
// the factory in src/db/index.ts picks this implementation instead
// of the SQLite one.

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DataSource } from '@/db/types';
import type { AuthUser, HSKLevel, Word, UserProfile, UserProgress, StudySession, MasteryLevel } from '@/types';

const SESSION_KEY = 'hsk.auth.session';

function getSupabaseConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as any;
  const url = extra.supabaseUrl as string;
  const key = extra.supabaseAnonKey as string;
  if (!url || !key) throw new Error('Supabase URL and anon key must be set in app.json -> expo.extra');
  return { url, key };
}

function createClientOnce() {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: {
      storage: {
        getItem: (k) => AsyncStorage.getItem(k),
        setItem: (k, v) => AsyncStorage.setItem(k, v),
        removeItem: (k) => AsyncStorage.removeItem(k),
      },
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}

// ---------- Helpers ----------

function toWord(r: any): Word {
  return {
    id: String(r.id),
    hsk_level: r.hsk_level as HSKLevel,
    chinese: r.chinese ?? '',
    pinyin: r.pinyin ?? '',
    english: r.english ?? '',
    pos: typeof r.pos === 'string' ? JSON.parse(r.pos || '[]') : (r.pos ?? []),
    pos_raw: r.pos_raw ?? '',
    example_sentences: typeof r.example_sentences === 'string' ? JSON.parse(r.example_sentences || '[]') : (r.example_sentences ?? []),
    audio_url: r.audio_url ?? '',
    radical: r.radical ?? '',
    stroke_count: r.stroke_count ?? 0,
    topic_category: r.topic_category ?? 'general',
  };
}

function toAuthUser(row: any, isSuper: boolean): AuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    is_admin: row.is_admin === 1 || row.is_admin === true || isSuper,
    is_super: isSuper,
  };
}

const SUPER_ADMIN_EMAIL = 'miltonbabu9666@gmail.com';

export async function createSupabaseDataSource(): Promise<DataSource> {
  const supabase = createClientOnce();

  // ---------- Vocab ----------

  const vocab: DataSource['vocab'] = {
    async init() {
      // No-op: Supabase tables are already created via SQL migration.
    },
    async getWordsByLevel(level: HSKLevel) {
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .eq('hsk_level', level)
        .order('id');
      if (error) throw error;
      return (data ?? []).map(toWord);
    },
    async getWordById(id: string) {
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null; // not found
        throw error;
      }
      return data ? toWord(data) : null;
    },
    async searchWords(query: string, limit = 50) {
      const q = `%${query.toLowerCase()}%`;
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .or(`chinese.ilike.${q},pinyin.ilike.${q},english.ilike.${q}`)
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(toWord);
    },
    async countByLevel() {
      const { data, error } = await supabase.rpc('count_words_by_level');
      if (error) throw error;
      const out: Record<HSKLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      if (data) {
        for (const r of data as any[]) {
          out[r.hsk_level as HSKLevel] = Number(r.count) || 0;
        }
      }
      return out;
    },
    async totalCount() {
      const { count, error } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
    async paginated({ level, query, page, pageSize }) {
      let builder = supabase.from('words').select('*', { count: 'exact' });
      if (level) builder = builder.eq('hsk_level', level);
      if (query && query.trim().length > 0) {
        const q = `%${query.toLowerCase()}%`;
        builder = builder.or(`chinese.ilike.${q},pinyin.ilike.${q},english.ilike.${q}`);
      }
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await builder
        .order('hsk_level')
        .order('id')
        .range(from, to);
      if (error) throw error;
      return { words: (data ?? []).map(toWord), total: count ?? 0 };
    },
    async createWord(w) {
      const { data, error } = await supabase
        .from('words')
        .insert({
          hsk_level: w.hsk_level,
          chinese: w.chinese,
          pinyin: w.pinyin,
          english: w.english,
          pos: w.pos ?? '[]',
          example_sentences: w.example_sentences ?? '[]',
          topic_category: w.topic_category ?? 'general',
        })
        .select('id')
        .single();
      if (error) throw error;
      return Number(data?.id) || 0;
    },
    async updateWord(id, updates) {
      const payload: Record<string, any> = {};
      if (updates.hsk_level !== undefined) payload.hsk_level = updates.hsk_level;
      if (updates.chinese !== undefined) payload.chinese = updates.chinese;
      if (updates.pinyin !== undefined) payload.pinyin = updates.pinyin;
      if (updates.english !== undefined) payload.english = updates.english;
      if (updates.pos !== undefined) payload.pos = updates.pos;
      if (updates.example_sentences !== undefined) payload.example_sentences = updates.example_sentences;
      if (updates.topic_category !== undefined) payload.topic_category = updates.topic_category;
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase
        .from('words')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    async deleteWord(id) {
      await supabase.from('user_progress').delete().eq('word_id', id);
      const { error } = await supabase.from('words').delete().eq('id', id);
      if (error) throw error;
    },
  };

  // ---------- Progress ----------

  const progress: DataSource['progress'] = {
    async getForUser(userId, wordId) {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('word_id', wordId)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data ? { ...data, id: String(data.id) } as UserProgress : null;
    },
    async getDueWords(userId, limit) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('user_progress')
        .select('word_id, next_review, words(*)')
        .eq('user_id', userId)
        .lte('next_review', now)
        .order('next_review')
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => toWord(r.words));
    },
    async upsert(p) {
      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: p.user_id,
          word_id: p.word_id,
          mastery_level: p.mastery_level,
          last_reviewed: p.last_reviewed,
          next_review: p.next_review,
          review_count: p.review_count,
          correct_count: p.correct_count,
          easiness_factor: p.easiness_factor,
          interval: p.interval,
        }, { onConflict: 'user_id, word_id' })
        .select('*')
        .single();
      if (error) throw error;
      return { ...(data as any), id: String(data?.id) } as UserProgress;
    },
    async countMasteredByLevel(userId) {
      const { data, error } = await supabase
        .from('user_progress')
        .select('words!inner(hsk_level)')
        .eq('user_id', userId)
        .gte('mastery_level', 4);
      if (error) throw error;
      const out: Record<HSKLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      for (const r of (data ?? []) as any[]) {
        const lvl = r.words?.hsk_level as HSKLevel;
        if (lvl) out[lvl] = (out[lvl] || 0) + 1;
      }
      return out;
    },
  };

  // ---------- Sessions ----------

  const sessions: DataSource['sessions'] = {
    async record(s) {
      const { data, error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: s.user_id,
          mode: s.mode,
          words_studied: s.words_studied,
          accuracy: s.accuracy,
          duration: s.duration,
          date: s.date,
        })
        .select('id')
        .single();
      if (error) throw error;
      return { ...s, id: String(data?.id ?? '') };
    },
    async recent(userId, limit) {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, id: String(r.id) })) as StudySession[];
    },
    async aggregateDaily(userId, days) {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('study_sessions')
        .select('date, words_studied, accuracy, duration')
        .eq('user_id', userId)
        .gte('date', since)
        .order('date');
      if (error) throw error;
      // Group by date client-side
      const map = new Map<string, { words_studied: number; accuracy: number; duration: number; count: number }>();
      for (const r of (data ?? []) as any[]) {
        const d = String(r.date).slice(0, 10);
        const entry = map.get(d) || { words_studied: 0, accuracy: 0, duration: 0, count: 0 };
        entry.words_studied += r.words_studied ?? 0;
        entry.accuracy += r.accuracy ?? 0;
        entry.duration += r.duration ?? 0;
        entry.count += 1;
        map.set(d, entry);
      }
      return Array.from(map.entries()).map(([date, v]) => ({
        date,
        words_studied: v.words_studied,
        accuracy: v.count > 0 ? v.accuracy / v.count : 0,
        duration: v.duration,
      }));
    },
  };

  // ---------- Profiles ----------

  const profiles: DataSource['profiles'] = {
    async get(userId) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as UserProfile | null;
    },
    async upsert(p) {
      const id = (p as any).id ?? undefined;
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id,
          email: p.email,
          username: p.username,
          avatar_url: p.avatar_url,
          daily_goal: p.daily_goal,
          streak_count: p.streak_count,
          last_study_date: p.last_study_date,
          created_at: (p as any).created_at,
        }, { onConflict: 'id' })
        .select('*')
        .single();
      if (error) throw error;
      return data as UserProfile;
    },
  };

  // ---------- Auth ----------

  let _currentUser: AuthUser | null = null;
  const authListeners = new Set<(u: AuthUser | null) => void>();
  const notify = (u: AuthUser | null) => {
    _currentUser = u;
    authListeners.forEach((cb) => cb(u));
  };

  const auth: DataSource['auth'] = {
    async restore() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      const isSuper = session.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
      const user: AuthUser = {
        id: session.user.id,
        email: session.user.email ?? '',
        username: profile?.username ?? session.user.user_metadata?.username ?? '',
        is_admin: profile?.is_admin === 1 || profile?.is_admin === true || isSuper,
        is_super: isSuper,
      };
      notify(user);
      return user;
    },
    async signUp({ email, username, password }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Sign-up failed');
      // Create profile row
      await supabase.from('user_profiles').insert({
        id: data.user.id,
        email,
        username,
        is_admin: false,
        is_active: true,
        daily_goal: 20,
        streak_count: 0,
      });
      const user: AuthUser = {
        id: data.user.id,
        email,
        username,
        is_admin: false,
        is_super: false,
      };
      notify(user);
      return user;
    },
    async signIn({ email, password }) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sign-in failed');
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL;
      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email ?? email,
        username: profile?.username ?? data.user.user_metadata?.username ?? '',
        is_admin: profile?.is_admin === 1 || profile?.is_admin === true || isSuper,
        is_super: isSuper,
      };
      notify(user);
      return user;
    },
    async signOut() {
      await supabase.auth.signOut();
      notify(null);
    },
    currentUser() {
      return _currentUser;
    },
    onChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
  };

  // Listen for Supabase auth state changes (e.g., token refresh, session expiry)
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      const isSuper = session.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
      const user: AuthUser = {
        id: session.user.id,
        email: session.user.email ?? '',
        username: profile?.username ?? session.user.user_metadata?.username ?? '',
        is_admin: profile?.is_admin === 1 || profile?.is_admin === true || isSuper,
        is_super: isSuper,
      };
      notify(user);
    } else {
      notify(null);
    }
  });

  // ---------- Chat (local-only, AsyncStorage) ----------

  const CHAT_KEY = 'hsk.chat.sessions.v1';

  const chat: DataSource['chat'] = {
    async listSessions() {
      const raw = await AsyncStorage.getItem(CHAT_KEY);
      const all = raw ? JSON.parse(raw) : [];
      return all.map((s: any) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        preview: s.messages?.slice(-1)?.[0]?.content?.slice(0, 80) ?? '',
      }));
    },
    async getSession(id) {
      const raw = await AsyncStorage.getItem(CHAT_KEY);
      const all = raw ? JSON.parse(raw) : [];
      return all.find((s: any) => s.id === id) ?? null;
    },
    async saveSession(session) {
      const raw = await AsyncStorage.getItem(CHAT_KEY);
      const all = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((s: any) => s.id === session.id);
      if (idx >= 0) all[idx] = session;
      else all.push(session);
      await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(all));
    },
    async deleteSession(id) {
      const raw = await AsyncStorage.getItem(CHAT_KEY);
      const all = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(all.filter((s: any) => s.id !== id)));
    },
  };

  // ---------- Users (admin) ----------

  const users: DataSource['users'] = {
    async list() {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, username, is_admin, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        email: r.email,
        username: r.username,
        is_admin: r.is_admin === 1 || r.is_admin === true,
        is_active: r.is_active === 1 || r.is_active === true,
        created_at: r.created_at,
      }));
    },
    async create({ email, username, password, is_admin = false }) {
      // Use Supabase Auth sign-up to create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');
      // Update the profile row
      await supabase
        .from('user_profiles')
        .update({ is_admin: is_admin ? 1 : 0 })
        .eq('id', authData.user.id);
      return authData.user.id;
    },
    async update(id, updates) {
      const payload: Record<string, any> = {};
      if (updates.email !== undefined) payload.email = updates.email;
      if (updates.username !== undefined) payload.username = updates.username;
      if (updates.is_admin !== undefined) payload.is_admin = updates.is_admin ? 1 : 0;
      if (updates.is_active !== undefined) payload.is_active = updates.is_active ? 1 : 0;
      if (updates.password !== undefined && updates.password.length > 0) {
        // Password reset via Supabase Auth admin API — requires service_role key.
        // For now, skip password update via anon key (needs edge function or admin API).
        // We'll handle this in a future iteration.
      }
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase
        .from('user_profiles')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    async hardDelete(id) {
      // Delete user data first
      await supabase.from('user_progress').delete().eq('user_id', id);
      await supabase.from('study_sessions').delete().eq('user_id', id);
      await supabase.from('leaderboard').delete().eq('user_id', id);
      const { error } = await supabase.from('user_profiles').delete().eq('id', id);
      if (error) throw error;
    },
    async clearData(id) {
      await supabase.from('user_progress').delete().eq('user_id', id);
      await supabase.from('study_sessions').delete().eq('user_id', id);
      await supabase.from('leaderboard').delete().eq('user_id', id);
      await supabase
        .from('user_profiles')
        .update({ streak_count: 0, last_study_date: null })
        .eq('id', id);
    },
    async totalCount() {
      const { count, error } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  };

  return { vocab, progress, sessions, profiles, auth, chat, users };
}