export type HSKLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'preposition' | 'conjunction' | 'particle' | 'measure' | 'number' | 'prefix' | 'suffix' | 'interjection' | 'other';

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
  is_loved: boolean;
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
  | 'listening'
  | 'flashcard'
  | 'timed-quiz'
  | 'sequential-quiz'
  | 'visual'
  | 'sentence-making'
  | 'sentence-puzzle'
  | 'translation'
  | 'shadowing'
  | 'handwriting'
  | 'story'
  | 'conversation'
  | 'smart-review'
  | 'exam';

export interface QuizQuestion {
  word: Word;
  type: 'mcq' | 'pinyin' | 'english' | 'fill-blank';
  options?: string[];
  correctAnswer: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string;
  score: number;
  accuracy: number;
  mode: LearningMode;
  date: string;
}

export interface DailyStats {
  date: string;
  words_studied: number;
  accuracy: number;
  duration: number;
}

export interface TopicCategory {
  id: string;
  name: string;
  name_en: string;
  word_count: number;
}

export interface UserStats {
  total_words_learned: number;
  total_study_time: number;
  average_accuracy: number;
  current_streak: number;
  longest_streak: number;
  mastery_distribution: Record<MasteryLevel, number>;
  level_progress: Record<HSKLevel, { learned: number; total: number }>;
}