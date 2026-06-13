// SQLite implementation of DataSource.
// Uses expo-sqlite (synchronous prepared statements).
//
// Schema intentionally mirrors hsk-vocab-app/src/services/database.ts
// (words, user_progress, study_sessions, user_profiles) so future
// Supabase migration can map 1:1.

import type { SQLiteDatabase } from "expo-sqlite";
import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hashPassword, verifyPassword } from "@/services/crypto";
import type { DataSource } from "@/db/types";
import type {
  AuthUser,
  HSKLevel,
  Word,
  UserProfile,
  UserProgress,
  StudySession,
  LearningMode,
  MasteryLevel,
} from "@/types";

// ===== Schema =====

const SCHEMA = `
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY,
  hsk_level INTEGER NOT NULL CHECK (hsk_level BETWEEN 1 AND 6),
  chinese TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  english TEXT DEFAULT '',
  pos TEXT DEFAULT '[]',
  pos_raw TEXT DEFAULT '',
  example_sentences TEXT DEFAULT '[]',
  audio_url TEXT DEFAULT '',
  radical TEXT DEFAULT '',
  stroke_count INTEGER DEFAULT 0,
  topic_category TEXT DEFAULT 'general'
);
CREATE INDEX IF NOT EXISTS idx_words_level ON words(hsk_level);
CREATE INDEX IF NOT EXISTS idx_words_chinese ON words(chinese);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  daily_goal INTEGER DEFAULT 20,
  streak_count INTEGER DEFAULT 0,
  last_study_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  is_admin INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  source TEXT DEFAULT 'mobile',
  hsk_level INTEGER DEFAULT 1,
  learning_reason TEXT DEFAULT NULL,
  onboarding_completed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  mastery_level INTEGER DEFAULT 0,
  last_reviewed TEXT DEFAULT (datetime('now')),
  next_review TEXT DEFAULT (datetime('now')),
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  easiness_factor REAL DEFAULT 2.50,
  interval INTEGER DEFAULT 1,
  UNIQUE(user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_due ON user_progress(user_id, next_review);

CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  words_studied INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0,
  duration INTEGER DEFAULT 0,
  date TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON study_sessions(user_id, date);

CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  score INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0,
  mode TEXT NOT NULL,
  date TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_mode ON leaderboard(mode);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
`;

// ===== Helper: row -> domain =====

type WordRow = {
  id: number;
  hsk_level: number;
  chinese: string;
  pinyin: string;
  english: string;
  pos: string;
  pos_raw: string;
  example_sentences: string;
  audio_url: string;
  radical: string;
  stroke_count: number;
  topic_category: string;
};

const rowToWord = (r: WordRow): Word => ({
  id: String(r.id),
  hsk_level: r.hsk_level as HSKLevel,
  chinese: r.chinese,
  pinyin: r.pinyin,
  english: r.english,
  pos: JSON.parse(r.pos || "[]"),
  pos_raw: r.pos_raw,
  example_sentences: JSON.parse(r.example_sentences || "[]"),
  audio_url: r.audio_url,
  radical: r.radical,
  stroke_count: r.stroke_count,
  topic_category: r.topic_category,
});

// ===== Factory =====

let _db: SQLiteDatabase | null = null;
let _currentUser: AuthUser | null = null;
const SESSION_KEY = "hsk.auth.session";

async function getDb(): Promise<SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("hsk.db");
  await _db.execAsync(SCHEMA);
  // Migration: detect and fix schema mismatches for old databases
  try {
    const cols = await _db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(user_profiles)",
    );
    const colNames = cols.map((c) => c.name);
    const missing = [
      "is_admin",
      "is_active",
      "source",
      "hsk_level",
      "learning_reason",
      "onboarding_completed",
    ].filter((c) => !colNames.includes(c));
    if (missing.length > 0) {
      // Old database — drop and recreate with correct schema
      await _db.execAsync("DROP TABLE IF EXISTS user_profiles");
      await _db.execAsync(
        `CREATE TABLE user_profiles (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          avatar_url TEXT DEFAULT '',
          daily_goal INTEGER DEFAULT 20,
          streak_count INTEGER DEFAULT 0,
          last_study_date TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          is_admin INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          source TEXT DEFAULT 'mobile',
          hsk_level INTEGER DEFAULT 1,
          learning_reason TEXT DEFAULT NULL,
          onboarding_completed INTEGER DEFAULT 0
        )`,
      );
      console.log(
        "[DB] Migrated: dropped and recreated user_profiles with new columns",
      );
    }
  } catch (e) {
    console.error("[DB] Migration check failed:", e);
  }
  return _db;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ===== Implementation =====

async function createSqliteDataSource(): Promise<DataSource> {
  const db = await getDb();

  // ---------- Vocab ----------

  const vocab = {
    async init() {
      // Idempotent: only seeds when empty
      const row = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) as c FROM words",
      );
      if ((row?.c ?? 0) === 0) {
        await seedVocabFromBundle(db);
      }
    },
    async getWordsByLevel(level: HSKLevel): Promise<Word[]> {
      const rows = await db.getAllAsync<WordRow>(
        "SELECT * FROM words WHERE hsk_level = ? ORDER BY id",
        [level],
      );
      return rows.map(rowToWord);
    },
    async getWordById(id: string): Promise<Word | null> {
      const row = await db.getFirstAsync<WordRow>(
        "SELECT * FROM words WHERE id = ?",
        [Number(id) || 0],
      );
      return row ? rowToWord(row) : null;
    },
    async searchWords(query: string, limit = 50): Promise<Word[]> {
      const q = `%${query.toLowerCase()}%`;
      const rows = await db.getAllAsync<WordRow>(
        `SELECT * FROM words
         WHERE LOWER(chinese) LIKE ? OR LOWER(pinyin) LIKE ? OR LOWER(english) LIKE ?
         LIMIT ?`,
        [q, q, q, limit],
      );
      return rows.map(rowToWord);
    },
    async countByLevel(): Promise<Record<HSKLevel, number>> {
      const rows = await db.getAllAsync<{ hsk_level: number; c: number }>(
        "SELECT hsk_level, COUNT(*) as c FROM words GROUP BY hsk_level",
      );
      const out: Record<HSKLevel, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
      };
      for (const r of rows) out[r.hsk_level as HSKLevel] = r.c;
      return out;
    },
    async totalCount(): Promise<number> {
      const r = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) as c FROM words",
      );
      return r?.c ?? 0;
    },
    async paginated({
      level,
      query,
      page,
      pageSize,
    }: {
      level?: number;
      query?: string;
      page: number;
      pageSize: number;
    }) {
      const where: string[] = [];
      const params: any[] = [];
      if (level) {
        where.push("hsk_level = ?");
        params.push(level);
      }
      if (query && query.trim().length > 0) {
        const like = `%${query.toLowerCase()}%`;
        where.push(
          "(LOWER(chinese) LIKE ? OR LOWER(pinyin) LIKE ? OR LOWER(english) LIKE ?)",
        );
        params.push(like, like, like);
      }
      const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
      const totalRow = await db.getFirstAsync<{ c: number }>(
        `SELECT COUNT(*) as c FROM words ${whereSql}`,
        params,
      );
      const offset = Math.max(0, (page - 1) * pageSize);
      const rows = await db.getAllAsync<WordRow>(
        `SELECT * FROM words ${whereSql} ORDER BY hsk_level, id LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      );
      return { words: rows.map(rowToWord), total: totalRow?.c ?? 0 };
    },
    async createWord(w: {
      hsk_level: number;
      chinese: string;
      pinyin: string;
      english: string;
      pos?: string;
      example_sentences?: string;
      topic_category?: string;
    }): Promise<number> {
      const result = await db.runAsync(
        `INSERT INTO words (hsk_level, chinese, pinyin, english, pos, example_sentences, topic_category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          w.hsk_level,
          w.chinese,
          w.pinyin,
          w.english,
          w.pos ?? "[]",
          w.example_sentences ?? "[]",
          w.topic_category ?? "general",
        ],
      );
      return Number(result.lastInsertRowId);
    },
    async updateWord(
      id: string | number,
      updates: {
        hsk_level?: number;
        chinese?: string;
        pinyin?: string;
        english?: string;
        pos?: string;
        example_sentences?: string;
        topic_category?: string;
      },
    ): Promise<void> {
      const numericId = typeof id === "string" ? Number(id) : id;
      const existing = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM words WHERE id = ?",
        [numericId],
      );
      if (!existing) throw new Error("Word not found");
      await db.runAsync(
        `UPDATE words SET
           hsk_level = COALESCE(?, hsk_level),
           chinese = COALESCE(?, chinese),
           pinyin = COALESCE(?, pinyin),
           english = COALESCE(?, english),
           pos = COALESCE(?, pos),
           example_sentences = COALESCE(?, example_sentences),
           topic_category = COALESCE(?, topic_category)
         WHERE id = ?`,
        [
          updates.hsk_level ?? null,
          updates.chinese ?? null,
          updates.pinyin ?? null,
          updates.english ?? null,
          updates.pos ?? null,
          updates.example_sentences ?? null,
          updates.topic_category ?? null,
          numericId,
        ],
      );
    },
    async deleteWord(id: string | number): Promise<void> {
      const numericId = typeof id === "string" ? Number(id) : id;
      await db.runAsync("DELETE FROM user_progress WHERE word_id = ?", [
        numericId,
      ]);
      await db.runAsync("DELETE FROM words WHERE id = ?", [numericId]);
    },
  };

  // ---------- Progress ----------

  const progress = {
    async getForUser(
      userId: string,
      wordId: string,
    ): Promise<UserProgress | null> {
      const row = await db.getFirstAsync<any>(
        "SELECT * FROM user_progress WHERE user_id = ? AND word_id = ?",
        [userId, wordId],
      );
      return row ? mapProgress(row) : null;
    },
    async getDueWords(userId: string, limit: number): Promise<Word[]> {
      const rows = await db.getAllAsync<WordRow>(
        `SELECT w.* FROM words w
         JOIN user_progress p ON p.word_id = w.id
         WHERE p.user_id = ? AND p.next_review <= datetime('now')
         ORDER BY p.next_review ASC
         LIMIT ?`,
        [userId, limit],
      );
      return rows.map(rowToWord);
    },
    async upsert(p: Omit<UserProgress, "id">): Promise<UserProgress> {
      await db.runAsync(
        `INSERT INTO user_progress
          (user_id, word_id, mastery_level, last_reviewed, next_review,
           review_count, correct_count, easiness_factor, interval)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, word_id) DO UPDATE SET
           mastery_level = excluded.mastery_level,
           last_reviewed = excluded.last_reviewed,
           next_review = excluded.next_review,
           review_count = excluded.review_count,
           correct_count = excluded.correct_count,
           easiness_factor = excluded.easiness_factor,
           interval = excluded.interval`,
        [
          p.user_id,
          p.word_id,
          p.mastery_level,
          p.last_reviewed,
          p.next_review,
          p.review_count,
          p.correct_count,
          p.easiness_factor,
          p.interval,
        ],
      );
      return p as UserProgress;
    },
    async countMasteredByLevel(
      userId: string,
    ): Promise<Record<HSKLevel, number>> {
      const rows = await db.getAllAsync<{ hsk_level: number; c: number }>(
        `SELECT w.hsk_level, COUNT(*) as c
         FROM user_progress p JOIN words w ON w.id = p.word_id
         WHERE p.user_id = ? AND p.mastery_level >= 4
         GROUP BY w.hsk_level`,
        [userId],
      );
      const out: Record<HSKLevel, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
      };
      for (const r of rows) out[r.hsk_level as HSKLevel] = r.c;
      return out;
    },
  };

  // ---------- Sessions ----------

  const sessions = {
    async record(s: Omit<StudySession, "id">): Promise<StudySession> {
      const result = await db.runAsync(
        `INSERT INTO study_sessions (user_id, mode, words_studied, accuracy, duration, date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.user_id, s.mode, s.words_studied, s.accuracy, s.duration, s.date],
      );
      return { ...s, id: String(result.lastInsertRowId) };
    },
    async recent(userId: string, limit: number): Promise<StudySession[]> {
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM study_sessions WHERE user_id = ? ORDER BY date DESC LIMIT ?`,
        [userId, limit],
      );
      return rows.map(mapSession);
    },
    async aggregateDaily(userId: string, days: number) {
      const rows = await db.getAllAsync<any>(
        `SELECT date(date) as date,
                SUM(words_studied) as words_studied,
                AVG(accuracy) as accuracy,
                SUM(duration) as duration
         FROM study_sessions
         WHERE user_id = ? AND date >= datetime('now', ?)
         GROUP BY date(date)
         ORDER BY date ASC`,
        [userId, `-${days} days`],
      );
      return rows.map((r) => ({
        date: r.date,
        words_studied: r.words_studied ?? 0,
        accuracy: r.accuracy ?? 0,
        duration: r.duration ?? 0,
      }));
    },
  };

  // ---------- Profiles ----------

  const profiles = {
    async get(userId: string): Promise<UserProfile | null> {
      const row = await db.getFirstAsync<any>(
        "SELECT * FROM user_profiles WHERE id = ?",
        [userId],
      );
      return row ? mapProfile(row) : null;
    },
    async upsert(
      p: Omit<UserProfile, "id"> & { id?: string },
    ): Promise<UserProfile> {
      const id = p.id ?? genId();
      await db.runAsync(
        `INSERT INTO user_profiles (id, email, username, avatar_url, daily_goal, streak_count, last_study_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           username = excluded.username,
           avatar_url = excluded.avatar_url,
           daily_goal = excluded.daily_goal,
           streak_count = excluded.streak_count,
           last_study_date = excluded.last_study_date`,
        [
          id,
          p.email,
          p.username,
          p.avatar_url,
          p.daily_goal,
          p.streak_count,
          p.last_study_date,
          p.created_at,
        ],
      );
      return { ...p, id } as UserProfile;
    },
    async updateStreak(userId: string): Promise<number> {
      const today = new Date().toISOString().split("T")[0];
      const row = await db.getFirstAsync<any>(
        "SELECT last_study_date, streak_count FROM user_profiles WHERE id = ?",
        [userId],
      );
      if (!row) return 0;

      const lastDate = row.last_study_date
        ? String(row.last_study_date).split("T")[0]
        : null;
      const currentStreak = row.streak_count || 0;

      if (lastDate === today) return currentStreak; // Already studied today

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

      await db.runAsync(
        "UPDATE user_profiles SET streak_count = ?, last_study_date = ? WHERE id = ?",
        [newStreak, today, userId],
      );
      return newStreak;
    },
  };

  // -------- Users (admin view) ----------

  const users = {
    async list() {
      const rows = await db.getAllAsync<any>(
        "SELECT id, email, username, is_admin, is_active, source, created_at FROM user_profiles ORDER BY created_at DESC",
      );
      return rows.map((r) => ({
        id: r.id,
        email: r.email,
        username: r.username,
        is_admin: r.is_admin === 1 || r.is_admin === true,
        is_active: r.is_active === 1 || r.is_active === true,
        source: r.source || "mobile",
        created_at: r.created_at,
      }));
    },
    async create({
      email,
      username,
      password,
      is_admin = false,
    }: {
      email: string;
      username: string;
      password: string;
      is_admin?: boolean;
    }) {
      const existing = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM user_profiles WHERE LOWER(email) = ?",
        [email.toLowerCase()],
      );
      if (existing) throw new Error("A user with this email already exists");
      const hash = await hashPassword(password);
      const id = genId();
      await db.runAsync(
        `INSERT INTO user_profiles (id, email, username, password_hash, is_admin, is_active, source, daily_goal, streak_count, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 'mobile', 20, 0, datetime('now'))`,
        [id, email, username, hash, is_admin ? 1 : 0],
      );
      return id;
    },
    async update(
      id: string,
      updates: {
        email?: string;
        username?: string;
        is_admin?: boolean;
        is_active?: boolean;
        password?: string;
      },
    ) {
      const parts: string[] = [];
      const params: any[] = [];
      if (updates.email !== undefined) {
        parts.push("email = ?");
        params.push(updates.email);
      }
      if (updates.username !== undefined) {
        parts.push("username = ?");
        params.push(updates.username);
      }
      if (updates.is_admin !== undefined) {
        parts.push("is_admin = ?");
        params.push(updates.is_admin ? 1 : 0);
      }
      if (updates.is_active !== undefined) {
        parts.push("is_active = ?");
        params.push(updates.is_active ? 1 : 0);
      }
      if (updates.password !== undefined && updates.password.length > 0) {
        parts.push("password_hash = ?");
        params.push(await hashPassword(updates.password));
      }
      if (parts.length === 0) return;
      params.push(id);
      await db.runAsync(
        `UPDATE user_profiles SET ${parts.join(", ")} WHERE id = ?`,
        params,
      );
    },
    async hardDelete(id: string) {
      await db.runAsync("DELETE FROM user_progress WHERE user_id = ?", [id]);
      await db.runAsync("DELETE FROM study_sessions WHERE user_id = ?", [id]);
      await db.runAsync("DELETE FROM user_profiles WHERE id = ?", [id]);
    },
    async clearData(id: string) {
      await db.runAsync("DELETE FROM user_progress WHERE user_id = ?", [id]);
      await db.runAsync("DELETE FROM study_sessions WHERE user_id = ?", [id]);
      await db.runAsync(
        "UPDATE user_profiles SET streak_count = 0, last_study_date = NULL WHERE id = ?",
        [id],
      );
    },
    async totalCount() {
      const r = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) as c FROM user_profiles",
      );
      return r?.c ?? 0;
    },
  };

  // ---------- Auth ----------

  const authListeners = new Set<(u: AuthUser | null) => void>();
  const notify = (u: AuthUser | null) => {
    _currentUser = u;
    authListeners.forEach((cb) => cb(u));
  };

  const auth = {
    async restore(): Promise<AuthUser | null> {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      try {
        const u = JSON.parse(raw) as AuthUser;
        _currentUser = u;
        return u;
      } catch {
        return null;
      }
    },
    async signUp({
      email,
      username,
      password,
    }: {
      email: string;
      username: string;
      password: string;
    }) {
      const existing = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM user_profiles WHERE LOWER(email) = ?",
        [email.toLowerCase()],
      );
      if (existing) throw new Error("Email already registered");
      const id = genId();
      const hash = await hashPassword(password);
      await db.runAsync(
        `INSERT INTO user_profiles (id, email, username, password_hash, is_admin, is_active, source, daily_goal, streak_count, created_at)
         VALUES (?, ?, ?, ?, 0, 1, 'mobile', 20, 0, datetime('now'))`,
        [id, email, username, hash],
      );
      const user: AuthUser = {
        id,
        email,
        username,
        is_admin: false,
        is_super: false,
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
      notify(user);
      return user;
    },
    async signIn({ email, password }: { email: string; password: string }) {
      const row = await db.getFirstAsync<any>(
        "SELECT * FROM user_profiles WHERE LOWER(email) = ?",
        [email.toLowerCase()],
      );
      if (!row) throw new Error("No account with that email");
      if (!(await verifyPassword(password, row.password_hash)))
        throw new Error("Wrong password");
      if (row.is_active === 0) throw new Error("Account is disabled");
      const isSuper =
        (row.email || "").toLowerCase() === "miltonbabu9666@gmail.com";
      const isAdmin = row.is_admin === 1 || row.is_admin === true || isSuper;
      const user: AuthUser = {
        id: row.id,
        email: row.email,
        username: row.username,
        is_admin: isAdmin,
        is_super: isSuper,
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
      notify(user);
      return user;
    },
    async signOut() {
      await AsyncStorage.removeItem(SESSION_KEY);
      notify(null);
    },
    currentUser() {
      return _currentUser;
    },
    onChange(cb: (u: AuthUser | null) => void) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
  };

  // --- Dev-seed helpers (commented out — uncomment for local dev) ---
  // To seed a test user for development, run this once and comment it back:
  //
  // try {
  //   const existing = await db.getFirstAsync<{ id: string }>(
  //     "SELECT id FROM user_profiles WHERE LOWER(email) = 'test@example.com'",
  //   );
  //   if (!existing) {
  //     const hash = await hashPassword('yourpassword');
  //     await db.runAsync(
  //       `INSERT INTO user_profiles (id, email, username, password_hash, is_admin, is_active, source, daily_goal, streak_count, created_at)
  //        VALUES (?, ?, ?, ?, 0, 1, 'mobile', 20, 0, datetime('now'))`,
  //       [genId(), 'test@example.com', 'TestUser', hash],
  //     );
  //     console.log("[DB] Seeded test user");
  //   }
  // } catch (e) {
  //   console.error("[DB] Seed test user failed:", e);
  // }

  // ---------- Chat (local-only, AsyncStorage) ----------

  const CHAT_KEY = "hsk.chat.sessions.v1";
  type StoredSession = {
    id: string;
    title: string;
    createdAt: number;
    messages: {
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: number;
    }[];
  };
  const readSessions = async (): Promise<StoredSession[]> => {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    return raw ? JSON.parse(raw) : [];
  };
  const writeSessions = (list: StoredSession[]) =>
    AsyncStorage.setItem(CHAT_KEY, JSON.stringify(list));

  const chat = {
    async listSessions() {
      const list = await readSessions();
      return list
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((s) => ({
          id: s.id,
          title: s.title,
          createdAt: s.createdAt,
          preview:
            s.messages[s.messages.length - 1]?.content.slice(0, 40) ?? "",
        }));
    },
    async getSession(id: string) {
      const list = await readSessions();
      return list.find((s) => s.id === id) ?? null;
    },
    async saveSession(session: StoredSession) {
      const list = await readSessions();
      const idx = list.findIndex((s) => s.id === session.id);
      if (idx >= 0) list[idx] = session;
      else list.unshift(session);
      await writeSessions(list);
    },
    async deleteSession(id: string) {
      const list = (await readSessions()).filter((s) => s.id !== id);
      await writeSessions(list);
    },
  };

  // ---------- Leaderboard ----------

  const leaderboard = {
    async getTop(mode: string, limit: number = 20) {
      const rows = await db.getAllAsync<any>(
        `SELECT user_id, username, avatar_url, MAX(score) as score, MAX(accuracy) as accuracy, mode, MAX(date) as date
         FROM leaderboard
         WHERE mode = ?
         GROUP BY user_id
         ORDER BY score DESC
         LIMIT ?`,
        [mode, limit],
      );
      return rows.map((r: any) => ({
        user_id: r.user_id,
        username: r.username,
        avatar_url: r.avatar_url || "",
        score: r.score || 0,
        accuracy: r.accuracy || 0,
        mode: r.mode,
        date: r.date,
      }));
    },
    async addEntry(entry: {
      user_id: string;
      username: string;
      avatar_url?: string;
      score: number;
      accuracy: number;
      mode: string;
      date?: string;
    }) {
      await db.runAsync(
        `INSERT INTO leaderboard (user_id, username, avatar_url, score, accuracy, mode, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.user_id,
          entry.username,
          entry.avatar_url || "",
          entry.score,
          entry.accuracy,
          entry.mode,
          entry.date || new Date().toISOString(),
        ],
      );
    },
    async getUserRank(mode: string, userId: string) {
      const rows = await db.getAllAsync<any>(
        `SELECT user_id, MAX(score) as score FROM leaderboard WHERE mode = ? GROUP BY user_id ORDER BY score DESC`,
        [mode],
      );
      const idx = rows.findIndex((r) => r.user_id === userId);
      return idx >= 0 ? idx + 1 : null;
    },
    async clear() {
      await db.runAsync("DELETE FROM leaderboard");
    },
  };

  return {
    vocab,
    progress,
    sessions,
    profiles,
    auth,
    chat,
    users,
    leaderboard,
  };
}

// ===== Seeders =====

async function seedVocabFromBundle(db: SQLiteDatabase) {
  // Lazy import to keep initial bundle small
  const { default: data } =
    await import("@/../assets/data/hsk_vocabulary_complete.json");
  // expected shape: { hsk_level_1: Word[], hsk_level_2: ..., hsk_vocabulary_complete: ... }
  const allWords: any[] = [];
  for (const key of Object.keys(data)) {
    if (!Array.isArray((data as any)[key])) continue;
    for (const w of (data as any)[key]) {
      allWords.push({
        hsk_level: w.hsk_level,
        chinese: w.chinese,
        pinyin: w.pinyin,
        english: w.english,
        pos: JSON.stringify(w.pos ?? []),
        pos_raw: w.pos_raw ?? "",
        example_sentences: JSON.stringify(w.example_sentences ?? []),
        audio_url: w.audio_url ?? "",
        radical: w.radical ?? "",
        stroke_count: w.stroke_count ?? 0,
        topic_category: w.topic_category ?? "general",
      });
    }
  }
  await db.withTransactionAsync(async () => {
    for (const w of allWords) {
      await db.runAsync(
        `INSERT INTO words
          (hsk_level, chinese, pinyin, english, pos, pos_raw, example_sentences,
           audio_url, radical, stroke_count, topic_category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          w.hsk_level,
          w.chinese,
          w.pinyin,
          w.english,
          w.pos,
          w.pos_raw,
          w.example_sentences,
          w.audio_url,
          w.radical,
          w.stroke_count,
          w.topic_category,
        ],
      );
    }
  });
}

// ===== Row mappers =====

function mapProgress(r: any): UserProgress {
  return {
    id: String(r.id),
    user_id: r.user_id,
    word_id: String(r.word_id),
    mastery_level: r.mastery_level as MasteryLevel,
    last_reviewed: r.last_reviewed,
    next_review: r.next_review,
    review_count: r.review_count,
    correct_count: r.correct_count,
    easiness_factor: r.easiness_factor,
    interval: r.interval,
  };
}

function mapSession(r: any): StudySession {
  return {
    id: String(r.id),
    user_id: r.user_id,
    mode: r.mode as LearningMode,
    words_studied: r.words_studied,
    accuracy: r.accuracy,
    duration: r.duration,
    date: r.date,
  };
}

function mapProfile(r: any): UserProfile {
  return {
    id: r.id,
    email: r.email,
    username: r.username,
    avatar_url: r.avatar_url,
    daily_goal: r.daily_goal,
    streak_count: r.streak_count,
    last_study_date: r.last_study_date,
    created_at: r.created_at,
    source: r.source || "mobile",
  };
}

// ===== Public entry =====

export async function createSqliteDataSourceAsync(): Promise<DataSource> {
  const ds = await createSqliteDataSource();
  await ds.vocab.init();
  return ds;
}
