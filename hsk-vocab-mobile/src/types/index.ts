// Shared domain types. Mirrors hsk-vocab-app/src/types/index.ts
// Keep these in sync with the web app.

export type HSKLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type PartOfSpeech =
  | 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun'
  | 'preposition' | 'conjunction' | 'particle' | 'measure'
  | 'number' | 'prefix' | 'suffix' | 'interjection' | 'other';

export interface Word {
  id: string;
  hsk_level: HSKLevel;
  chinese: string;
  pinyin: string;
  english: string;
  pos: string[];
  pos_raw: string;
  example_sentences: string[];
  audio_url: string;
  radical: string;
  stroke_count: number;
  topic_category: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  word_id: string;
  mastery_level: MasteryLevel;
  last_reviewed: string;
  next_review: string;
  review_count: number;
  correct_count: number;
  easiness_factor: number;
  interval: number;
}

export interface StudySession {
  id: string;
  user_id: string;
  mode: LearningMode;
  words_studied: number;
  accuracy: number;
  duration: number;
  date: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  avatar_url: string;
  daily_goal: number;
  streak_count: number;
  last_study_date: string;
  created_at: string;
  source?: string;
  hsk_level?: number;
  learning_reason?: string;
  onboarding_completed?: boolean;
}

export interface UserPreferences {
  hsk_level: number;
  daily_goal: number;
  learning_reason: string;
  onboarding_completed: boolean;
}

export type LearningMode =
  | 'listening' | 'flashcard' | 'timed-quiz' | 'sequential-quiz'
  | 'visual' | 'sentence-making' | 'sentence-puzzle' | 'translation'
  | 'shadowing' | 'handwriting' | 'story' | 'conversation'
  | 'smart-review' | 'exam' | 'reading' | 'writing'
  | 'diagnostic' | 'mistakes';

export type Skill = 'listening' | 'reading' | 'writing' | 'vocabulary' | 'speaking';

export interface Mistake {
  id: string;
  user_id: string;
  word_id: string | null;
  chinese: string;
  pinyin: string;
  english: string;
  skill: Skill;
  mode: string;
  user_answer: string;
  correct_answer: string;
  mastered: boolean;
  retry_count: number;
  created_at: string;
}

export interface NewMistake {
  user_id: string;
  word_id: string | null;
  chinese: string;
  pinyin: string;
  english: string;
  skill: Skill;
  mode: string;
  user_answer: string;
  correct_answer: string;
}

export interface DiagnosticResult {
  id: string;
  user_id: string;
  hsk_level: number;
  overall: number;
  skill_scores: { skill: Skill; score: number }[];
  weak_words: string[];
  level3_mastery: number | null;
  level4_readiness: number | null;
  created_at: string;
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  exam_length: string;
  total_questions: number;
  correct: number;
  accuracy: number;
  duration: number;
  section_results: Record<string, { correct: number; total: number }>;
  started_at: string;
  completed_at: string;
}

export interface WritingSessionRecord {
  id: string;
  user_id: string;
  hsk_level: number;
  scope: string;
  practice_mode: string;
  order_type: string;
  question_count: number;
  correct_count: number;
  accuracy: number;
  started_at: string;
  completed_at: string;
}

export interface WritingAttemptRecord {
  id: string;
  session_id: string;
  user_id: string;
  word_id: string | null;
  question_type: string;
  expected_answer: string;
  user_answer: string;
  is_correct: boolean;
  accuracy: number;
  time_taken: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  words?: Word[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  is_admin?: boolean;
  is_super?: boolean;
}

// Admin-facing vocabulary record (simplified string fields, like web).
export interface AdminWord {
  id: string;
  hsk_level: number;
  chinese: string;
  pinyin: string;
  english: string;
  pos: string;
  example_sentences: string;
  topic_category: string;
  created_at?: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  is_admin?: boolean;
  is_active?: boolean;
  source?: string;
  created_at?: string;
}
