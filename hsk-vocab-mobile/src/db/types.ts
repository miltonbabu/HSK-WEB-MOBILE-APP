// =====================================================================
// DATA SOURCE ABSTRACTION
// ---------------------------------------------------------------------
// The app code (screens, stores, services) only ever talks to these
// interfaces. Two implementations exist:
//
//   - src/db/sqlite   → local on-device database (current / MVP)
//   - src/db/supabase → cloud database (drop-in later)
//
// Swap by changing one line in src/db/index.ts.
// Every screen / store imports from "@/db" — never from a concrete
// implementation.
// =====================================================================

import type {
  Word,
  UserProgress,
  StudySession,
  UserProfile,
  AuthUser,
  HSKLevel,
  LearningMode,
  MasteryLevel,
} from '@/types';

// -------- Vocab (read-only content, plus admin CRUD helpers) --------

export interface VocabRepository {
  init(): Promise<void>;
  getWordsByLevel(level: HSKLevel): Promise<Word[]>;
  getWordById(id: string): Promise<Word | null>;
  searchWords(query: string, limit?: number): Promise<Word[]>;
  countByLevel(): Promise<Record<HSKLevel, number>>;
  totalCount(): Promise<number>;
  paginated(opts: { level?: number; query?: string; page: number; pageSize: number }): Promise<{ words: Word[]; total: number }>;
  createWord(w: { hsk_level: number; chinese: string; pinyin: string; english: string; pos?: string; example_sentences?: string; topic_category?: string }): Promise<number>;
  updateWord(id: string | number, updates: { hsk_level?: number; chinese?: string; pinyin?: string; english?: string; pos?: string; example_sentences?: string; topic_category?: string }): Promise<void>;
  deleteWord(id: string | number): Promise<void>;
}

// -------- User progress --------

export interface ProgressRepository {
  getForUser(userId: string, wordId: string): Promise<UserProgress | null>;
  getDueWords(userId: string, limit: number): Promise<Word[]>;
  upsert(progress: Omit<UserProgress, 'id'>): Promise<UserProgress>;
  countMasteredByLevel(userId: string): Promise<Record<HSKLevel, number>>;
}

// -------- Study sessions --------

export interface SessionRepository {
  record(session: Omit<StudySession, 'id'>): Promise<StudySession>;
  recent(userId: string, limit: number): Promise<StudySession[]>;
  aggregateDaily(userId: string, days: number): Promise<
    { date: string; words_studied: number; accuracy: number; duration: number }[]
  >;
}

// -------- Profiles --------

export interface ProfileRepository {
  get(userId: string): Promise<UserProfile | null>;
  upsert(profile: Omit<UserProfile, 'id'> & { id?: string }): Promise<UserProfile>;
}

// -------- Auth --------

export interface AuthRepository {
  /** Restore session from secure storage on app launch. */
  restore(): Promise<AuthUser | null>;
  signUp(input: { email: string; username: string; password: string }): Promise<AuthUser>;
  signIn(input: { email: string; password: string }): Promise<AuthUser>;
  signOut(): Promise<void>;
  currentUser(): AuthUser | null;
  /** Subscribe to auth state changes. Returns unsubscribe fn. */
  onChange(cb: (user: AuthUser | null) => void): () => void;
}

// -------- AI chat history (local-only) --------

export interface ChatRepository {
  listSessions(): Promise<
    { id: string; title: string; createdAt: number; preview: string }[]
  >;
  getSession(id: string): Promise<{
    id: string;
    title: string;
    createdAt: number;
    messages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }[];
  } | null>;
  saveSession(session: {
    id: string;
    title: string;
    createdAt: number;
    messages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }[];
  }): Promise<void>;
  deleteSession(id: string): Promise<void>;
}

// -------- Aggregate interface --------

export interface DataSource {
  vocab: VocabRepository;
  progress: ProgressRepository;
  sessions: SessionRepository;
  profiles: ProfileRepository;
  auth: AuthRepository;
  chat: ChatRepository;
  users: UserRepository;
}

// -------- Users (admin management of user accounts) --------

export interface UserRepository {
  list(): Promise<
    {
      id: string;
      email: string;
      username: string;
      is_admin: boolean;
      is_active: boolean;
      created_at?: string;
    }[]
  >;
  create(input: { email: string; username: string; password: string; is_admin?: boolean }): Promise<string>;
  update(id: string, updates: { email?: string; username?: string; is_admin?: boolean; is_active?: boolean; password?: string }): Promise<void>;
  hardDelete(id: string): Promise<void>;
  clearData(id: string): Promise<void>;
  totalCount(): Promise<number>;
}
