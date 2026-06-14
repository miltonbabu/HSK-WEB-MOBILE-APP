// Supabase implementation of DataSource.
// This file connects to the same Supabase project as the web app,
// so both apps share one database and auth system.
//
// All data queries use native fetch() directly (not the Supabase client)
// because the Supabase client's internal fetch has reliability issues in React Native.
// The Supabase client is only used for auth session management.

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DataSource } from "@/db/types";
import type {
  AuthUser,
  HSKLevel,
  Word,
  UserProfile,
  UserProgress,
  StudySession,
  MasteryLevel,
} from "@/types";

const SESSION_KEY = "hsk.auth.session";

function getSupabaseConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env",
    );
  }
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
      autoRefreshToken: false,
      persistSession: true,
    },
    global: {
      fetch: (input, init) => fetch(input, init),
    },
  });
}

// ---------- Helpers ----------

function toWord(r: any): Word {
  return {
    id: String(r.id),
    hsk_level: r.hsk_level as HSKLevel,
    chinese: r.chinese ?? "",
    pinyin: r.pinyin ?? "",
    english: r.english ?? "",
    pos: typeof r.pos === "string" ? JSON.parse(r.pos || "[]") : (r.pos ?? []),
    pos_raw: r.pos_raw ?? "",
    example_sentences:
      typeof r.example_sentences === "string"
        ? JSON.parse(r.example_sentences || "[]")
        : (r.example_sentences ?? []),
    audio_url: r.audio_url ?? "",
    radical: r.radical ?? "",
    stroke_count: r.stroke_count ?? 0,
    topic_category: r.topic_category ?? "general",
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

const SUPER_ADMIN_EMAIL = "miltonbabu9666@gmail.com";

// ── Direct fetch helpers ──
// All data queries use native fetch() because the Supabase client's internal
// fetch has reliability issues in React Native (timeouts, hangs).
// Native fetch is proven to work — auth login and AI chat already use it.

let _accessToken: string | null = null;

const FETCH_TIMEOUT_MS = 10_000; // 10s timeout per request

function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

function authHeaders(): Record<string, string> {
  const { key } = getSupabaseConfig();
  const h: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (_accessToken) {
    h["Authorization"] = `Bearer ${_accessToken}`;
  }
  return h;
}

async function restGet(
  path: string,
  opts?: { head?: boolean; range?: [number, number] },
): Promise<any> {
  const { url } = getSupabaseConfig();
  const headers = authHeaders();
  if (opts?.head) {
    headers["Prefer"] = "count=exact";
  }
  if (opts?.range) {
    headers["Range"] = `${opts.range[0]}-${opts.range[1]}`;
    headers["Prefer"] = "count=exact";
  }
  const res = await fetchWithTimeout(`${url}/rest/v1/${path}`, {
    method: opts?.head ? "HEAD" : "GET",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `REST error ${res.status}`);
  }
  if (opts?.head || opts?.range) {
    // Return: { data: [...], count: number }
    const rangeHeader = res.headers.get("content-range");
    let count = 0;
    if (rangeHeader) {
      const parts = rangeHeader.split("/");
      count = parseInt(parts[parts.length - 1]) || 0;
    }
    if (opts?.head) return count;
    const data = await res.json();
    return { data, count };
  }
  return res.json();
}

async function restPost(path: string, body: any): Promise<any> {
  const { url } = getSupabaseConfig();
  const headers = authHeaders();
  headers["Prefer"] = "return=representation";
  const res = await fetchWithTimeout(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `REST error ${res.status}`);
  }
  return res.json();
}

async function restPatch(path: string, body: any): Promise<void> {
  const { url } = getSupabaseConfig();
  const headers = authHeaders();
  const res = await fetchWithTimeout(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `REST error ${res.status}`);
  }
}

async function restDelete(path: string): Promise<void> {
  const { url } = getSupabaseConfig();
  const headers = authHeaders();
  const res = await fetchWithTimeout(`${url}/rest/v1/${path}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `REST error ${res.status}`);
  }
}

// ── URL-encode Supabase filters ──
function encodeFilter(s: string): string {
  return encodeURIComponent(s).replace(/%2C/g, ",").replace(/%3D/g, "=");
}

// ── In-memory cache ──
// Words are static vocab data — fetch once, serve instantly thereafter.
// This eliminates loading spinners on every screen navigation.
const _wordCache = new Map<HSKLevel, Word[]>();
let _allWordsCache: Word[] | null = null;
let _countByLevelCache: Record<HSKLevel, number> | null = null;
let _totalCountCache: number | null = null;

function invalidateVocabCache() {
  _wordCache.clear();
  _allWordsCache = null;
  _countByLevelCache = null;
  _totalCountCache = null;
}

export async function createSupabaseDataSource(): Promise<DataSource> {
  const supabase = createClientOnce();

  // ---------- Vocab ----------

  const vocab: DataSource["vocab"] = {
    async init() {
      // Pre-fetch all vocab data in parallel so screens load instantly
      try {
        const levels = [1, 2, 3, 4] as HSKLevel[];
        const results = await Promise.all(
          levels.map((level) =>
            restGet(`words?hsk_level=eq.${level}&order=id`),
          ),
        );
        const all: Word[] = [];
        results.forEach((data, i) => {
          const words = (data ?? []).map(toWord);
          _wordCache.set(levels[i], words);
          all.push(...words);
        });
        _allWordsCache = all;
        _totalCountCache = all.length;
        const counts: Record<HSKLevel, number> = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
        };
        for (const w of all) {
          counts[w.hsk_level] = (counts[w.hsk_level] || 0) + 1;
        }
        _countByLevelCache = counts;
      } catch {
        // Non-fatal — individual methods will fall back to network
      }
    },
    async getWordsByLevel(level: HSKLevel) {
      if (_wordCache.has(level)) return _wordCache.get(level)!;
      const data = await restGet(`words?hsk_level=eq.${level}&order=id`);
      const words = (data ?? []).map(toWord);
      _wordCache.set(level, words);
      return words;
    },
    async getWordById(id: string) {
      // Search cache first
      if (_allWordsCache) {
        const found = _allWordsCache.find((w) => w.id === id);
        if (found) return found;
      }
      const data = await restGet(`words?id=eq.${id}`);
      const row = (data ?? [])[0];
      return row ? toWord(row) : null;
    },
    async searchWords(query: string, limit = 50) {
      // Use cached words for searching — way faster than network
      if (_allWordsCache && _allWordsCache.length > 0) {
        const q = query.toLowerCase().trim();
        if (!q) return _allWordsCache.slice(0, limit);
        const results = _allWordsCache.filter(
          (w) =>
            w.chinese.toLowerCase().includes(q) ||
            w.pinyin.toLowerCase().includes(q) ||
            w.english.toLowerCase().includes(q),
        );
        return results.slice(0, limit);
      }
      // Fallback to network
      const q = `%${query.toLowerCase()}%`;
      const filter = `or=(chinese.ilike.${encodeFilter(q)},pinyin.ilike.${encodeFilter(q)},english.ilike.${encodeFilter(q)})`;
      const data = await restGet(`words?${filter}&limit=${limit}`);
      return (data ?? []).map(toWord);
    },
    async countByLevel() {
      if (_countByLevelCache) return _countByLevelCache;
      try {
        const data = await restPost("rpc/count_words_by_level", {});
        const out: Record<HSKLevel, number> = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
        };
        if (data) {
          for (const r of data as any[]) {
            out[r.hsk_level as HSKLevel] = Number(r.count) || 0;
          }
        }
        _countByLevelCache = out;
        return out;
      } catch {
        return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      }
    },
    async totalCount() {
      if (_totalCountCache !== null) return _totalCountCache;
      const count = await restGet("words", { head: true });
      _totalCountCache = typeof count === "number" ? count : 0;
      return _totalCountCache;
    },
    async paginated({ level, query, page, pageSize }) {
      const params: string[] = [];
      if (level) params.push(`hsk_level=eq.${level}`);
      if (query && query.trim().length > 0) {
        const q = `%${query.toLowerCase()}%`;
        params.push(
          `or=(chinese.ilike.${encodeFilter(q)},pinyin.ilike.${encodeFilter(q)},english.ilike.${encodeFilter(q)})`,
        );
      }
      params.push("order=hsk_level", "order=id");
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count } = await restGet(`words?${params.join("&")}`, {
        range: [from, to],
      });
      return { words: (data ?? []).map(toWord), total: count ?? 0 };
    },
    async createWord(w) {
      const data = await restPost("words", {
        hsk_level: w.hsk_level,
        chinese: w.chinese,
        pinyin: w.pinyin,
        english: w.english,
        pos: w.pos ?? "[]",
        example_sentences: w.example_sentences ?? "[]",
        topic_category: w.topic_category ?? "general",
      });
      invalidateVocabCache();
      return Number((data?.[0] ?? data)?.id) || 0;
    },
    async updateWord(id, updates) {
      const payload: Record<string, any> = {};
      if (updates.hsk_level !== undefined)
        payload.hsk_level = updates.hsk_level;
      if (updates.chinese !== undefined) payload.chinese = updates.chinese;
      if (updates.pinyin !== undefined) payload.pinyin = updates.pinyin;
      if (updates.english !== undefined) payload.english = updates.english;
      if (updates.pos !== undefined) payload.pos = updates.pos;
      if (updates.example_sentences !== undefined)
        payload.example_sentences = updates.example_sentences;
      if (updates.topic_category !== undefined)
        payload.topic_category = updates.topic_category;
      if (Object.keys(payload).length === 0) return;
      await restPatch(`words?id=eq.${id}`, payload);
      invalidateVocabCache();
    },
    async deleteWord(id) {
      await restDelete(`user_progress?word_id=eq.${id}`);
      await restDelete(`words?id=eq.${id}`);
      invalidateVocabCache();
    },
  };

  // ---------- Progress ----------

  const progress: DataSource["progress"] = {
    async getForUser(userId, wordId) {
      const data = await restGet(
        `user_progress?user_id=eq.${userId}&word_id=eq.${wordId}`,
      );
      const row = (data ?? [])[0];
      return row ? ({ ...row, id: String(row.id) } as UserProgress) : null;
    },
    async getDueWords(userId, limit) {
      const now = new Date().toISOString();
      const data = await restGet(
        `user_progress?select=word_id,next_review,words(*)&user_id=eq.${userId}&next_review=lte.${now}&order=next_review&limit=${limit}`,
      );
      return (data ?? []).map((r: any) => toWord(r.words));
    },
    async upsert(p) {
      // Supabase REST upsert: POST with Prefer: resolution=merge-duplicates
      // and the on_conflict column specified as a query param
      const headers = authHeaders();
      headers["Prefer"] = "resolution=merge-duplicates,return=representation";
      const { url } = getSupabaseConfig();
      const res = await fetchWithTimeout(
        `${url}/rest/v1/user_progress?on_conflict=user_id,word_id`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: p.user_id,
            word_id: p.word_id,
            mastery_level: p.mastery_level,
            last_reviewed: p.last_reviewed,
            next_review: p.next_review,
            review_count: p.review_count,
            correct_count: p.correct_count,
            easiness_factor: p.easiness_factor,
            interval: p.interval,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || `REST error ${res.status}`);
      }
      const data = await res.json();
      const row = data?.[0] ?? data;
      return { ...row, id: String(row.id) } as UserProgress;
    },
    async countMasteredByLevel(userId) {
      const data = await restGet(
        `user_progress?select=words!inner(hsk_level)&user_id=eq.${userId}&mastery_level=gte.4`,
      );
      const out: Record<HSKLevel, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
      };
      for (const r of (data ?? []) as any[]) {
        const lvl = r.words?.hsk_level as HSKLevel;
        if (lvl) out[lvl] = (out[lvl] || 0) + 1;
      }
      return out;
    },
  };

  // ---------- Sessions ----------

  const sessions: DataSource["sessions"] = {
    async record(s) {
      const data = await restPost("study_sessions", {
        user_id: s.user_id,
        mode: s.mode,
        words_studied: s.words_studied,
        accuracy: s.accuracy,
        duration: s.duration,
        date: s.date,
      });
      const row = data?.[0] ?? data;
      return { ...s, id: String(row?.id ?? "") };
    },
    async recent(userId, limit) {
      const data = await restGet(
        `study_sessions?user_id=eq.${userId}&order=date.desc&limit=${limit}`,
      );
      return (data ?? []).map((r: any) => ({
        ...r,
        id: String(r.id),
      })) as StudySession[];
    },
    async aggregateDaily(userId, days) {
      const since = new Date(Date.now() - days * 86400000)
        .toISOString()
        .slice(0, 10);
      const data = await restGet(
        `study_sessions?select=date,words_studied,accuracy,duration&user_id=eq.${userId}&date=gte.${since}&order=date`,
      );
      const map = new Map<
        string,
        {
          words_studied: number;
          accuracy: number;
          duration: number;
          count: number;
        }
      >();
      for (const r of (data ?? []) as any[]) {
        const d = String(r.date).slice(0, 10);
        const entry = map.get(d) || {
          words_studied: 0,
          accuracy: 0,
          duration: 0,
          count: 0,
        };
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

  const profiles: DataSource["profiles"] = {
    async get(userId) {
      const data = await restGet(`user_profiles?id=eq.${userId}`);
      const row = (data ?? [])[0];
      return row ? (row as UserProfile) : null;
    },
    async upsert(p) {
      const id = (p as any).id ?? undefined;
      const headers = authHeaders();
      headers["Prefer"] = "resolution=merge-duplicates,return=representation";
      const { url } = getSupabaseConfig();
      const res = await fetchWithTimeout(
        `${url}/rest/v1/user_profiles?on_conflict=id`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            id,
            email: p.email,
            username: p.username,
            avatar_url: p.avatar_url,
            daily_goal: p.daily_goal,
            streak_count: p.streak_count,
            last_study_date: p.last_study_date,
            created_at: (p as any).created_at,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || `REST error ${res.status}`);
      }
      const data = await res.json();
      return (data?.[0] ?? data) as UserProfile;
    },
    async updateStreak(userId: string): Promise<number> {
      const today = new Date().toISOString().split("T")[0];
      const data = await restGet(
        `user_profiles?select=last_study_date,streak_count&id=eq.${userId}`,
      );
      const profile = (data ?? [])[0];
      if (!profile) return 0;

      const lastDate = profile.last_study_date
        ? String(profile.last_study_date).split("T")[0]
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
        newStreak = diffDays === 1 ? currentStreak + 1 : 1;
      } else {
        newStreak = 1;
      }

      await restPatch(`user_profiles?id=eq.${userId}`, {
        streak_count: newStreak,
        last_study_date: today,
      });
      return newStreak;
    },
  };

  // ---------- Auth ----------

  let _currentUser: AuthUser | null = null;
  const authListeners = new Set<(u: AuthUser | null) => void>();
  const notify = (u: AuthUser | null) => {
    _currentUser = u;
    authListeners.forEach((cb) => cb(u));
  };

  const auth: DataSource["auth"] = {
    async restore() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return null;

      // Store access token for subsequent direct fetch calls
      if (session.access_token) {
        _accessToken = session.access_token;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      const isSuper = session.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
      const user: AuthUser = {
        id: session.user.id,
        email: session.user.email ?? "",
        username:
          profile?.username ?? session.user.user_metadata?.username ?? "",
        is_admin:
          profile?.is_admin === 1 || profile?.is_admin === true || isSuper,
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
      if (!data.user) throw new Error("Sign-up failed");

      if (!data.session) {
        throw new Error(
          "Please check your email to confirm your account before logging in.",
        );
      }

      // Store access token
      if (data.session.access_token) {
        _accessToken = data.session.access_token;
      }

      await supabase.from("user_profiles").insert({
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
      const { url, key } = getSupabaseConfig();
      const res = await fetchWithTimeout(
        `${url}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
          },
          body: JSON.stringify({ email, password, gotrue_meta_security: {} }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as any).error_description ||
            (err as any).msg ||
            `Auth failed (${res.status})`,
        );
      }
      const authData = await res.json();
      if (!authData.user) throw new Error("Sign-in failed");

      // Store access token for ALL subsequent direct fetch calls
      if (authData.access_token) {
        _accessToken = authData.access_token;
      }

      // Set the session so auth state change listeners work
      if (authData.access_token) {
        await supabase.auth.setSession({
          access_token: authData.access_token,
          refresh_token: authData.refresh_token,
        });
      }

      // Fetch profile
      let profile: any = null;
      try {
        const pData = await restGet(
          `user_profiles?select=*&id=eq.${authData.user.id}`,
        );
        profile = (pData ?? [])[0];
      } catch {
        // ignore
      }

      if (!profile) {
        // Create profile row
        try {
          await restPost("user_profiles", {
            id: authData.user.id,
            email: authData.user.email ?? email,
            username:
              authData.user.user_metadata?.username ?? email.split("@")[0],
            is_admin: false,
            is_active: true,
            daily_goal: 20,
            streak_count: 0,
          });
          const pData = await restGet(
            `user_profiles?select=*&id=eq.${authData.user.id}`,
          );
          profile = (pData ?? [])[0];
        } catch {
          // ignore
        }
      }

      const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL;
      const user: AuthUser = {
        id: authData.user.id,
        email: authData.user.email ?? email,
        username:
          profile?.username ??
          authData.user.user_metadata?.username ??
          email.split("@")[0],
        is_admin:
          profile?.is_admin === 1 || profile?.is_admin === true || isSuper,
        is_super: isSuper,
      };
      notify(user);
      return user;
    },
    async signOut() {
      _accessToken = null;
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

  // Listen for Supabase auth state changes
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      if (session.access_token) {
        _accessToken = session.access_token;
      }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      const isSuper = session.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
      const user: AuthUser = {
        id: session.user.id,
        email: session.user.email ?? "",
        username:
          profile?.username ?? session.user.user_metadata?.username ?? "",
        is_admin:
          profile?.is_admin === 1 || profile?.is_admin === true || isSuper,
        is_super: isSuper,
      };
      notify(user);
    } else {
      _accessToken = null;
      notify(null);
    }
  });

  // ---------- Chat (local-only, AsyncStorage) ----------

  const CHAT_KEY = "hsk.chat.sessions.v1";

  const chat: DataSource["chat"] = {
    async listSessions() {
      const raw = await AsyncStorage.getItem(CHAT_KEY);
      const all = raw ? JSON.parse(raw) : [];
      return all.map((s: any) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        preview: s.messages?.slice(-1)?.[0]?.content?.slice(0, 80) ?? "",
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
      await AsyncStorage.setItem(
        CHAT_KEY,
        JSON.stringify(all.filter((s: any) => s.id !== id)),
      );
    },
  };

  // ---------- Users (admin) ----------

  const users: DataSource["users"] = {
    async list() {
      const data = await restGet(
        "user_profiles?select=id,email,username,is_admin,is_active,created_at&order=created_at.desc",
      );
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");
      await restPatch(`user_profiles?id=eq.${authData.user.id}`, {
        is_admin: is_admin ? 1 : 0,
      });
      return authData.user.id;
    },
    async update(id, updates) {
      const payload: Record<string, any> = {};
      if (updates.email !== undefined) payload.email = updates.email;
      if (updates.username !== undefined) payload.username = updates.username;
      if (updates.is_admin !== undefined)
        payload.is_admin = updates.is_admin ? 1 : 0;
      if (updates.is_active !== undefined)
        payload.is_active = updates.is_active ? 1 : 0;
      if (Object.keys(payload).length === 0) return;
      await restPatch(`user_profiles?id=eq.${id}`, payload);
    },
    async hardDelete(id) {
      await restDelete(`user_progress?user_id=eq.${id}`);
      await restDelete(`study_sessions?user_id=eq.${id}`);
      await restDelete(`leaderboard?user_id=eq.${id}`);
      await restDelete(`user_profiles?id=eq.${id}`);
    },
    async clearData(id) {
      await restDelete(`user_progress?user_id=eq.${id}`);
      await restDelete(`study_sessions?user_id=eq.${id}`);
      await restDelete(`leaderboard?user_id=eq.${id}`);
      await restPatch(`user_profiles?id=eq.${id}`, {
        streak_count: 0,
        last_study_date: null,
      });
    },
    async totalCount() {
      const count = await restGet("user_profiles", { head: true });
      return typeof count === "number" ? count : 0;
    },
  };

  // ---------- Leaderboard ----------

  const leaderboard: DataSource["leaderboard"] = {
    async getTop(mode: string, limit = 20) {
      const data = await restGet(
        `leaderboard?select=user_id,username,avatar_url,score,accuracy,mode,date&mode=eq.${mode}&order=score.desc&limit=${limit}`,
      );
      const bestByUser = new Map<string, any>();
      for (const r of data ?? []) {
        const existing = bestByUser.get(r.user_id);
        if (!existing || r.score > existing.score) {
          bestByUser.set(r.user_id, r);
        }
      }
      return Array.from(bestByUser.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
    async addEntry(entry) {
      await restPost("leaderboard", {
        user_id: entry.user_id,
        username: entry.username,
        avatar_url: entry.avatar_url || "",
        score: entry.score,
        accuracy: entry.accuracy,
        mode: entry.mode,
        date: entry.date || new Date().toISOString(),
      });
    },
    async getUserRank(mode: string, userId: string) {
      const data = await restGet(
        `leaderboard?select=user_id,score&mode=eq.${mode}&order=score.desc`,
      );
      const seen = new Set<string>();
      const ranked: string[] = [];
      for (const r of data ?? []) {
        if (!seen.has(r.user_id)) {
          seen.add(r.user_id);
          ranked.push(r.user_id);
        }
      }
      const idx = ranked.indexOf(userId);
      return idx >= 0 ? idx + 1 : null;
    },
    async clear() {
      await restDelete("leaderboard?id=neq.0");
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
