import { initDatabase, query, run, hasData } from './database';
import { Word, UserProgress, StudySession, UserProfile, LeaderboardEntry, HSKLevel } from '@/types';
import { supabase, isDevelopment, isSupabaseConfigured, createMockJWT, parseTokenPayload, getStoredToken, setStoredToken, clearStoredToken, hashPassword } from './supabase';

let isInitialized = false;

function parsePosArray(pos: any): string[] {
  if (!pos) return [];
  if (Array.isArray(pos)) return pos;
  if (typeof pos === 'string') {
    try {
      const parsed = JSON.parse(pos);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return pos ? [pos] : [];
    }
  }
  return [];
}

async function ensureDb() {
  if (!isInitialized) {
    await initDatabase();
    isInitialized = true;
  }
}

// In-memory cache for the words table. The vocabulary rarely changes
// after the initial seed, so caching the parsed Word[] list avoids
// re-running a 2000+ row query + JSON.parse per page mount.
let wordsCache: Word[] | null = null;
let wordsCachePromise: Promise<Word[]> | null = null;

function mapWordRow(r: any): Word {
  return {
    id: String(r.id),
    hsk_level: r.hsk_level as HSKLevel,
    chinese: r.chinese,
    pinyin: r.pinyin,
    english: r.english || '',
    pos: parsePosArray(r.pos),
    pos_raw: r.pos_raw || '',
    example_sentences: JSON.parse(r.example_sentences || '[]'),
    audio_url: r.audio_url || '',
    radical: r.radical || '',
    stroke_count: r.stroke_count || 0,
    topic_category: r.topic_category || 'general',
  };
}

export const wordService = {
  async getAll(): Promise<Word[]> {
    if (wordsCache) return wordsCache;
    if (wordsCachePromise) return wordsCachePromise;
    await ensureDb();
    wordsCachePromise = (async () => {
      const results = query('SELECT * FROM words ORDER BY hsk_level, id');
      wordsCache = results.map(mapWordRow);
      wordsCachePromise = null;
      return wordsCache;
    })();
    return wordsCachePromise;
  },

  async getByLevel(level: HSKLevel): Promise<Word[]> {
    await ensureDb();
    const results = query('SELECT * FROM words WHERE hsk_level = ? ORDER BY id', [level]);
    return results.map(mapWordRow);
  },

  async search(searchTerm: string): Promise<Word[]> {
    await ensureDb();
    const likeQuery = `%${searchTerm}%`;
    const results = query(
      `SELECT * FROM words WHERE chinese LIKE ? OR pinyin LIKE ? OR english LIKE ? ORDER BY hsk_level`,
      [likeQuery, likeQuery, likeQuery]
    );
    return results.map(mapWordRow);
  },
};

export function invalidateWordsCache(): void {
  wordsCache = null;
  wordsCachePromise = null;
}

export const progressService = {
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    await ensureDb();
    const results = query('SELECT * FROM user_progress WHERE user_id = ?', [userId]);
    return results.map((r: any) => ({
      id: String(r.id),
      user_id: r.user_id,
      word_id: String(r.word_id),
      mastery_level: r.mastery_level as any,
      last_reviewed: r.last_reviewed,
      next_review: r.next_review,
      review_count: r.review_count,
      correct_count: r.correct_count,
      easiness_factor: r.easiness_factor,
      interval: r.interval,
      is_loved: !!r.is_loved,
    }));
  },

  async toggleLoved(wordId: string, userId: string): Promise<boolean> {
    await ensureDb();
    const existing = query(
      'SELECT is_loved FROM user_progress WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    const newVal = existing.length > 0 && existing[0].is_loved ? 0 : 1;

    if (existing.length > 0) {
      run('UPDATE user_progress SET is_loved = ? WHERE user_id = ? AND word_id = ?', [
        newVal,
        userId,
        wordId,
      ]);
    } else {
      run(
        'INSERT INTO user_progress (user_id, word_id, is_loved) VALUES (?, ?, ?)',
        [userId, wordId, newVal]
      );
    }
    return !!newVal;
  },

  async getLovedWordIds(userId: string): Promise<string[]> {
    await ensureDb();
    const results = query(
      'SELECT word_id FROM user_progress WHERE user_id = ? AND is_loved = 1',
      [userId]
    );
    return results.map((r: any) => String(r.word_id));
  },

  async updateProgress(progress: Partial<UserProgress> & { word_id: string }, userId: string): Promise<void> {
    await ensureDb();
    
    const existing = query('SELECT * FROM user_progress WHERE user_id = ? AND word_id = ?', [userId, progress.word_id]);
    
    if (existing.length > 0) {
      run(
        `UPDATE user_progress SET 
          mastery_level = COALESCE(?, mastery_level),
          easiness_factor = COALESCE(?, easiness_factor),
          interval = COALESCE(?, interval),
          next_review = COALESCE(?, next_review),
          review_count = review_count + 1,
          correct_count = correct_count + COALESCE(?, 0),
          last_reviewed = CURRENT_TIMESTAMP
        WHERE user_id = ? AND word_id = ?`,
        [
          progress.mastery_level,
          progress.easiness_factor,
          progress.interval,
          progress.next_review,
          progress.correct_count && progress.correct_count > 2 ? 1 : 0,
          userId,
          progress.word_id
        ]
      );
    } else {
      run(
        `INSERT INTO user_progress (user_id, word_id, mastery_level, easiness_factor, interval, next_review)
         VALUES (?, ?, ?, 2.5, 1, datetime('now', '+1 day'))`,
        [userId, progress.word_id, progress.mastery_level || 0]
      );
    }
  },

  async getDueReviews(userId: string): Promise<UserProgress[]> {
    await ensureDb();
    const results = query(
      'SELECT * FROM user_progress WHERE user_id = ? AND next_review <= CURRENT_TIMESTAMP',
      [userId]
    );
    return results.map((r: any) => ({
      id: String(r.id),
      user_id: r.user_id,
      word_id: String(r.word_id),
      mastery_level: r.mastery_level as any,
      last_reviewed: r.last_reviewed,
      next_review: r.next_review,
      review_count: r.review_count,
      correct_count: r.correct_count,
      easiness_factor: r.easiness_factor,
      interval: r.interval,
      is_loved: !!r.is_loved,
    }));
  },
};

export const sessionService = {
  async recordSession(session: Omit<StudySession, 'id' | 'date'>): Promise<void> {
    await ensureDb();
    run(
      'INSERT INTO study_sessions (user_id, mode, words_studied, accuracy, duration) VALUES (?, ?, ?, ?, ?)',
      [session.user_id, session.mode, session.words_studied, session.accuracy, session.duration]
    );
  },

  async getStats(userId: string, days: number = 30): Promise<{ date: string; words_studied: number; accuracy: number; duration: number }[]> {
    await ensureDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const results = query(
      'SELECT * FROM study_sessions WHERE user_id = ? AND date >= ? ORDER BY date DESC',
      [userId, cutoff.toISOString()]
    );
    
    return results.map((r: any) => ({
      date: r.date,
      words_studied: r.words_studied,
      accuracy: r.accuracy,
      duration: r.duration,
    }));
  },
};

export async function updateStreak(userId: string): Promise<number> {
  await ensureDb();
  const today = new Date().toISOString().split('T')[0];
  const rows = query('SELECT last_study_date, streak_count FROM user_profiles WHERE id = ?', [userId]);
  if (rows.length === 0) return 0;

  const lastDate = rows[0].last_study_date ? String(rows[0].last_study_date).split('T')[0] : null;
  const currentStreak = rows[0].streak_count || 0;

  if (lastDate === today) return currentStreak; // Already studied today

  let newStreak: number;
  if (lastDate) {
    const last = new Date(lastDate);
    const now = new Date(today);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      newStreak = currentStreak + 1; // Consecutive day
    } else {
      newStreak = 1; // Gap — reset
    }
  } else {
    newStreak = 1; // First time
  }

  run(
    'UPDATE user_profiles SET streak_count = ?, last_study_date = ? WHERE id = ?',
    [newStreak, today, userId]
  );
  
  // Update auth store with new streak
  try {
    const { useAuthStore } = await import('@/stores');
    const currentUser = useAuthStore.getState().user;
    if (currentUser && String(currentUser.id) === String(userId)) {
      useAuthStore.setState({ user: { ...currentUser, streak_count: newStreak } });
    }
  } catch { /* ignore if store not available */ }
  
  return newStreak;
}

export async function getTodayProgress(userId: string): Promise<{ wordsStudied: number; accuracy: number; duration: number }> {
  await ensureDb();
  const today = new Date().toISOString().split('T')[0];
  const results = query(
    "SELECT * FROM study_sessions WHERE user_id = ? AND date >= ?",
    [userId, today]
  );

  if (results.length === 0) return { wordsStudied: 0, accuracy: 0, duration: 0 };

  const totalWords = results.reduce((sum: number, r: any) => sum + (r.words_studied || 0), 0);
  const totalDuration = results.reduce((sum: number, r: any) => sum + (r.duration || 0), 0);
  const avgAccuracy = results.reduce((sum: number, r: any) => sum + (r.accuracy || 0), 0) / results.length;

  return { wordsStudied: totalWords, accuracy: Math.round(avgAccuracy), duration: totalDuration };
}

export async function getUserProgress(userId: string): Promise<UserProgress[]> {
  await ensureDb();
  const results = query(
    `SELECT * FROM user_progress WHERE user_id = ?`,
    [userId]
  );
  return results.map((r: any) => ({
    ...r,
    mastery_level: r.mastery_level ?? 0,
  }));
}

export async function getDueReviewCount(userId: string): Promise<number> {
  await ensureDb();
  const results = query(
    "SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND next_review <= datetime('now')",
    [userId]
  );
  return results[0]?.count || 0;
}

export async function getWeakWords(userId: string, limit: number = 50): Promise<Word[]> {
  await ensureDb();
  const results = query(
    `SELECT w.*, up.mastery_level, up.correct_count, up.review_count
     FROM words w 
     JOIN user_progress up ON w.id = up.word_id 
     WHERE up.user_id = ? AND up.mastery_level < 3 
     ORDER BY up.mastery_level ASC, up.correct_count ASC, up.review_count DESC 
     LIMIT ?`,
    [userId, limit]
  );
  return results.map((r: any) => ({
    id: String(r.id),
    hsk_level: r.hsk_level as HSKLevel,
    chinese: r.chinese,
    pinyin: r.pinyin,
    english: r.english || '',
    pos: parsePosArray(r.pos),
    pos_raw: r.pos_raw || '',
    example_sentences: JSON.parse(r.example_sentences || '[]'),
    audio_url: r.audio_url || '',
    radical: r.radical || '',
    stroke_count: r.stroke_count || 0,
    topic_category: r.topic_category || 'general',
  }));
}

export async function getWeakWordsCount(userId: string): Promise<number> {
  await ensureDb();
  const results = query(
    `SELECT COUNT(*) as count FROM user_progress 
     WHERE user_id = ? AND mastery_level < 3`,
    [userId]
  );
  return results[0]?.count || 0;
}

export const authService = {
  async signUp(email: string, password: string, username: string): Promise<{ user: UserProfile; token: string }> {
    await ensureDb();

    if (isDevelopment || !isSupabaseConfigured()) {
      try {
        const hashed = await hashPassword(password);
        run(
          'INSERT INTO user_profiles (email, username, password_hash, source) VALUES (?, ?, ?, \'web\')',
          [email, username, hashed]
        );

        const results = query('SELECT * FROM user_profiles WHERE email = ?', [email]);
        const user = {
          id: String(results[0].id),
          email: results[0].email || email,
          username: results[0].username || username,
          avatar_url: results[0].avatar_url || '',
          daily_goal: results[0].daily_goal || 20,
          streak_count: results[0].streak_count || 0,
          last_study_date: results[0].last_study_date || '',
          created_at: results[0].created_at || new Date().toISOString(),
        } as UserProfile;

        const token = createMockJWT({
          sub: String(user.id),
          email: user.email,
          username: user.username,
        });
        setStoredToken(token);

        return { user, token };
      } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint failed')) {
          throw new Error('Email already exists');
        }
        throw error;
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;

    // If email confirmation is enabled in Supabase, session will be null.
    // Show a clear message instead of silently failing.
    if (!data.session && data.user) {
      throw new Error(
        'Account created! Please check your email to confirm your account before signing in. ' +
        'Tip: You can disable email confirmations in Supabase Dashboard → Authentication → Settings.'
      );
    }

    const session = data.session;
    if (session?.access_token) {
      setStoredToken(session.access_token);
    }

    const user: UserProfile = {
      id: data.user?.id || '',
      email: data.user?.email || email,
      username,
      avatar_url: '',
      daily_goal: 20,
      streak_count: 0,
      last_study_date: '',
      created_at: new Date().toISOString(),
    };
    return { user, token: session?.access_token || '' };
  },

  async signIn(email: string, _password: string): Promise<{ user: UserProfile; token: string }> {
    await ensureDb();

    if (isDevelopment || !isSupabaseConfigured()) {
      const results = query('SELECT * FROM user_profiles WHERE email = ?', [email]);
      if (results.length === 0) {
        throw new Error('Invalid email or password');
      }

      if (results[0].password_hash) {
        const hashed = await hashPassword(_password);
        if (results[0].password_hash !== hashed) {
          throw new Error('Invalid email or password');
        }
      }

      const user = {
        id: String(results[0].id),
        email: results[0].email || email,
        username: results[0].username || '',
        avatar_url: results[0].avatar_url || '',
        daily_goal: results[0].daily_goal || 20,
        streak_count: results[0].streak_count || 0,
        last_study_date: results[0].last_study_date || '',
        created_at: results[0].created_at || new Date().toISOString(),
      } as UserProfile;
      const token = createMockJWT({
        sub: String(user.id),
        email: user.email,
        username: user.username,
      });
      setStoredToken(token);

      return { user, token };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: _password,
    });
    if (error) throw error;

    const session = data.session;
    if (session?.access_token) {
      setStoredToken(session.access_token);
    }

    const user: UserProfile = {
      id: data.user?.id || '',
      email: data.user?.email || email,
      username: data.user?.user_metadata?.username || email.split('@')[0],
      avatar_url: '',
      daily_goal: 20,
      streak_count: 0,
      last_study_date: '',
      created_at: new Date().toISOString(),
    };
    return { user, token: session?.access_token || '' };
  },

  async signInWithGoogle(): Promise<{ user: UserProfile; token: string }> {
    if (isDevelopment && !isSupabaseConfigured()) {
      throw new Error('Google login not available in dev mode');
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) throw error;

    return { user: {} as UserProfile, token: '' };
  },

  async signOut(): Promise<void> {
    clearStoredToken();

    if (isDevelopment && !isSupabaseConfigured()) {
      return;
    }

    await supabase.auth.signOut();
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    await ensureDb();

    const token = getStoredToken();
    if (!token) return null;

    const payload = parseTokenPayload(token);
    if (!payload) return null;

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearStoredToken();
      return null;
    }

    if (isDevelopment && !isSupabaseConfigured()) {
      const results = query('SELECT * FROM user_profiles WHERE id = ?', [payload.sub]);
      if (results.length === 0) {
        return {
          id: payload.sub || 'guest-user',
          email: payload.email || 'guest@local',
          username: payload.username || 'Guest',
          avatar_url: '',
          daily_goal: 20,
          streak_count: 0,
          last_study_date: '',
          created_at: new Date().toISOString(),
        };
      }
      const row = results[0];
      return {
        id: String(row.id),
        email: row.email || '',
        username: row.username || '',
        avatar_url: row.avatar_url || '',
        daily_goal: row.daily_goal || 20,
        streak_count: row.streak_count || 0,
        last_study_date: row.last_study_date || '',
        created_at: row.created_at || new Date().toISOString(),
      } as UserProfile;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      clearStoredToken();
      return null;
    }
    return {
      id: data.user.id,
      email: data.user.email || '',
      username: data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'User',
      avatar_url: '',
      daily_goal: 20,
      streak_count: 0,
      last_study_date: '',
      created_at: new Date().toISOString(),
    };
  },

  async updateUsername(userId: string, username: string): Promise<void> {
    await ensureDb();

    if (isDevelopment && !isSupabaseConfigured()) {
      const existing = query('SELECT id FROM user_profiles WHERE username = ? AND id != ?', [username, userId]);
      if (existing.length > 0) {
        throw new Error('Username already taken');
      }
      run('UPDATE user_profiles SET username = ? WHERE id = ?', [username, userId]);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      data: { username },
    });
    if (error) throw error;
  },

  async deleteUser(userId: string): Promise<void> {
    await ensureDb();

    if (isDevelopment && !isSupabaseConfigured()) {
      run('DELETE FROM user_progress WHERE user_id = ?', [userId]);
      run('DELETE FROM study_sessions WHERE user_id = ?', [userId]);
      run('DELETE FROM leaderboard WHERE user_id = ?', [userId]);
      run('DELETE FROM user_profiles WHERE id = ?', [userId]);
      clearStoredToken();
      return;
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    clearStoredToken();
  },

  getGuestId(): string {
    let guestId = localStorage.getItem('guest_id');
    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem('guest_id', guestId);
    }
    return guestId;
  },

  getToken(): string | null {
    return getStoredToken();
  },
};

export const leaderboardService = {
  async getTop(mode: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    await ensureDb();
    // Get the best score per user for this mode
    const results = query(
      `SELECT user_id, username, avatar_url, MAX(score) as score, MAX(accuracy) as accuracy, mode, MAX(date) as date
       FROM leaderboard 
       WHERE mode = ? 
       GROUP BY user_id 
       ORDER BY score DESC 
       LIMIT ?`,
      [mode, limit]
    );
    return results.map((r: any) => ({
      id: String(r.id || r.user_id),
      user_id: r.user_id,
      username: r.username,
      avatar_url: r.avatar_url || '',
      score: r.score,
      accuracy: r.accuracy,
      mode: r.mode,
      date: r.date,
    }));
  },

  async addEntry(entry: Omit<LeaderboardEntry, 'id'>): Promise<void> {
    await ensureDb();
    run(
      'INSERT INTO leaderboard (user_id, username, avatar_url, score, accuracy, mode) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.user_id, entry.username, entry.avatar_url, entry.score, entry.accuracy, entry.mode]
    );
  },
};

// Seed data functions
export async function seedVocabulary(words: Array<{
  hsk_level: number;
  chinese: string;
  pinyin: string;
  english: string;
  pos: string;
  pos_raw: string;
  category: string;
  example_sentences?: string;
  radical?: string;
  stroke_count?: number;
}>): Promise<number> {
  await ensureDb();
  
  let count = 0;
  for (const word of words) {
    try {
      run(
        `INSERT OR IGNORE INTO words (hsk_level, chinese, pinyin, english, pos, pos_raw, topic_category, example_sentences, radical, stroke_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [word.hsk_level, word.chinese, word.pinyin, word.english, word.pos, word.pos_raw || '', word.category, word.example_sentences || '[]', word.radical || '', word.stroke_count || 0]
      );
      count++;
    } catch (e) {
      // Skip duplicates
    }
  }
  
  console.log(`Seeded ${count} vocabulary words`);
  invalidateWordsCache();
  return count;
}

// Export database info
export { hasData };

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  await ensureDb();
  const results = query('SELECT * FROM user_profiles ORDER BY created_at DESC');
  return results.map((r: any) => ({ ...r, id: String(r.id) }));
}

// Get user profile with real streak from database
export async function getUserProfile(userId: string): Promise<{ streak_count: number; daily_goal: number } | null> {
  await ensureDb();
  const results = query('SELECT streak_count, daily_goal FROM user_profiles WHERE id = ?', [userId]);
  if (results.length === 0) return null;
  return {
    streak_count: results[0].streak_count || 0,
    daily_goal: results[0].daily_goal || 20,
  };
}

export async function seedTestUsers(): Promise<void> {
  await ensureDb();

  const testUsers = [
    { email: 'miltonbabu9666@gmail.com', username: 'Super Admin', password: 'milton9666', is_admin: 1 },
    { email: 'test@test.com', username: 'TestUser', password: 'test123', is_admin: 0 },
    { email: 'lihua@test.com', username: 'LiHua', password: 'test123', is_admin: 0 },
    { email: 'ming@test.com', username: 'Ming', password: 'test123', is_admin: 0 },
  ];

  for (const u of testUsers) {
    const existing = query('SELECT id FROM user_profiles WHERE email = ?', [u.email]);
    const hashed = await hashPassword(u.password);

    if (existing.length > 0) {
      // Ensure the correct admin flag + password hash are set
      run('UPDATE user_profiles SET password_hash = COALESCE(NULLIF(password_hash, ""), ?), is_admin = ? WHERE email = ?', [hashed, u.is_admin, u.email]);
      continue;
    }

    run(
      'INSERT INTO user_profiles (email, username, password_hash, is_admin) VALUES (?, ?, ?, ?)',
      [u.email, u.username, hashed, u.is_admin]
    );
  }

  // Legacy/catch-up: ensure any row still missing the admin column default is corrected.
  try {
    run('UPDATE user_profiles SET is_admin = 0 WHERE is_admin IS NULL OR is_admin = ""');
  } catch {
    // ignore if the column isn't available yet on older dbs
  }
}