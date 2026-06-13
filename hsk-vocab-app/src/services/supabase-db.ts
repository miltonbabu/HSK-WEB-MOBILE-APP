// Supabase data layer for the web app.
// Mirrors the mobile app's src/db/supabase/index.ts,
// providing the same interfaces but using the browser Supabase client.
//
// Use these services instead of sqlite-api.ts when Supabase is configured.
// The admin.service.ts already handles both paths internally.

import { supabase } from './supabase';
import type { Word, HSKLevel, UserProgress, StudySession, UserProfile, LeaderboardEntry } from '@/types';

// ── Helpers ──

function toWord(r: any): Word {
  return {
    id: String(r.id),
    hsk_level: r.hsk_level as HSKLevel,
    chinese: r.chinese ?? '',
    pinyin: r.pinyin ?? '',
    english: r.english ?? '',
    pos: typeof r.pos === 'string' ? JSON.parse(r.pos || '[]') : (r.pos ?? []),
    pos_raw: r.pos_raw ?? '',
    example_sentences:
      typeof r.example_sentences === 'string'
        ? JSON.parse(r.example_sentences || '[]')
        : (r.example_sentences ?? []),
    audio_url: r.audio_url ?? '',
    radical: r.radical ?? '',
    stroke_count: r.stroke_count ?? 0,
    topic_category: r.topic_category ?? 'general',
  };
}

// ── Vocab ──

export const supabaseVocab = {
  async getWordsByLevel(level: HSKLevel): Promise<Word[]> {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('hsk_level', level)
      .order('id');
    if (error) throw error;
    return (data ?? []).map(toWord);
  },

  async getAll(): Promise<Word[]> {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .order('hsk_level')
      .order('id');
    if (error) throw error;
    return (data ?? []).map(toWord);
  },

  async search(query: string, limit = 50): Promise<Word[]> {
    const q = `%${query.toLowerCase()}%`;
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .or(`chinese.ilike.${q},pinyin.ilike.${q},english.ilike.${q}`)
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toWord);
  },

  async getWordById(id: string): Promise<Word | null> {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? toWord(data) : null;
  },
};

// ── Progress ──

export const supabaseProgress = {
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, id: String(r.id) })) as UserProgress[];
  },

  async updateProgress(progress: Partial<UserProgress> & { word_id: string }, userId: string): Promise<void> {
    // Check if record exists
    const { data: existing } = await supabase
      .from('user_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('word_id', progress.word_id)
      .single();

    if (existing) {
      const updates: Record<string, any> = {};
      if (progress.mastery_level !== undefined) updates.mastery_level = progress.mastery_level;
      if (progress.easiness_factor !== undefined) updates.easiness_factor = progress.easiness_factor;
      if (progress.interval !== undefined) updates.interval = progress.interval;
      if (progress.next_review !== undefined) updates.next_review = progress.next_review;
      if (progress.correct_count !== undefined) updates.correct_count = progress.correct_count;
      updates.review_count = ((existing as any).review_count || 0) + 1;
      updates.last_reviewed = new Date().toISOString();

      const { error } = await supabase
        .from('user_progress')
        .update(updates)
        .eq('id', (existing as any).id);
      if (error) throw error;
    } else {
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + 1);
      const { error } = await supabase
        .from('user_progress')
        .insert({
          user_id: userId,
          word_id: progress.word_id,
          mastery_level: progress.mastery_level || 0,
          easiness_factor: 2.5,
          interval: 1,
          next_review: nextReview.toISOString(),
          review_count: 0,
          correct_count: 0,
        });
      if (error) throw error;
    }
  },

  async getDueReviews(userId: string): Promise<UserProgress[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .lte('next_review', now)
      .order('next_review');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, id: String(r.id) })) as UserProgress[];
  },

  async getDueReviewCount(userId: string): Promise<number> {
    const now = new Date().toISOString();
    const { count, error } = await supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review', now);
    if (error) throw error;
    return count ?? 0;
  },

  async getWeakWords(userId: string, limit = 10): Promise<Word[]> {
    const { data, error } = await supabase
      .from('user_progress')
      .select('word_id, words(*)')
      .eq('user_id', userId)
      .lt('mastery_level', 3)
      .order('correct_count')
      .order('review_count', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r: any) => toWord(r.words));
  },
};

// ── Sessions ──

export const supabaseSessions = {
  async recordSession(session: Omit<StudySession, 'id' | 'date'>): Promise<void> {
    const { error } = await supabase.from('study_sessions').insert({
      user_id: session.user_id,
      mode: session.mode,
      words_studied: session.words_studied,
      accuracy: session.accuracy,
      duration: session.duration,
    });
    if (error) throw error;
  },

  async getStats(userId: string, days = 30): Promise<{ date: string; words_studied: number; accuracy: number; duration: number }[]> {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
      .from('study_sessions')
      .select('date, words_studied, accuracy, duration')
      .eq('user_id', userId)
      .gte('date', since)
      .order('date', { ascending: false });
    if (error) throw error;

    // Group by date
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
      accuracy: v.count > 0 ? Math.round(v.accuracy / v.count) : 0,
      duration: v.duration,
    }));
  },
};

// ── Profiles ──

export const supabaseProfiles = {
  async updateStreak(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('last_study_date, streak_count')
      .eq('id', userId)
      .single();
    if (error || !profile) return 0;

    const lastDate = profile.last_study_date
      ? String(profile.last_study_date).split('T')[0]
      : null;
    const currentStreak = profile.streak_count || 0;

    if (lastDate === today) return currentStreak;

    let newStreak: number;
    if (lastDate) {
      const last = new Date(lastDate);
      const now = new Date(today);
      const diffDays = Math.floor(
        (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        newStreak = currentStreak + 1;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    await supabase
      .from('user_profiles')
      .update({ streak_count: newStreak, last_study_date: today })
      .eq('id', userId);
    return newStreak;
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
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

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
  },
};

// ── Leaderboard ──

export const supabaseLeaderboard = {
  async getTop(mode: string, limit = 10): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('user_id, username, avatar_url, score, accuracy, mode, date')
      .eq('mode', mode)
      .order('score', { ascending: false })
      .limit(limit * 2); // get more to deduplicate

    if (error) throw error;

    // Get best score per user
    const bestByUser = new Map<string, any>();
    for (const r of data ?? []) {
      const existing = bestByUser.get(r.user_id);
      if (!existing || r.score > existing.score) {
        bestByUser.set(r.user_id, r);
      }
    }

    return Array.from(bestByUser.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r: any) => ({
        user_id: r.user_id,
        username: r.username,
        avatar_url: r.avatar_url || '',
        score: r.score,
        accuracy: r.accuracy,
        mode: r.mode as any,
        date: r.date,
      }));
  },

  async addEntry(entry: Omit<LeaderboardEntry, 'date'> & { date?: string }): Promise<void> {
    const { error } = await supabase.from('leaderboard').insert({
      user_id: entry.user_id,
      username: entry.username,
      avatar_url: entry.avatar_url || '',
      score: entry.score,
      accuracy: entry.accuracy,
      mode: entry.mode,
      date: entry.date || new Date().toISOString(),
    });
    if (error) throw error;
  },
};