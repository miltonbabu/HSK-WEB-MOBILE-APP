import { HSKLevel } from './index'

/** How the prompt is presented to the learner. */
export type WritingDirection =
  | 'en-pinyin'
  | 'pinyin'
  | 'en'
  | 'zh-pinyin'
  | 'zh'
  | 'sentence'

export type WritingOrder = 'sequential' | 'random'
export type WritingScope = 'level' | 'cumulative'
export type SentenceDifficulty = 'short' | 'medium' | 'long'
export type WritingQuestionType = 'vocabulary' | 'sentence'

export interface WritingSettings {
  hskLevel: HSKLevel
  scope: WritingScope
  direction: WritingDirection
  order: WritingOrder
  /** 0 means "All available". */
  questionCount: number
  difficulty: SentenceDifficulty
}

export interface WritingQuestion {
  id: string
  type: WritingQuestionType
  direction: WritingDirection
  hskLevel: HSKLevel
  wordId: string | null
  promptChinese: string | null
  promptPinyin: string | null
  promptEnglish: string | null
  expectedAnswer: string
  pinyin: string
  meaning: string
  targetWords: string[]
}

export type CharDiffKind = 'same' | 'wrong' | 'missing' | 'extra'

export interface CharDiffOp {
  kind: CharDiffKind
  expectedChar: string | null
  actualChar: string | null
}

export interface AnswerEvaluation {
  correct: boolean
  /** 0..1 share of expected characters matched. */
  accuracy: number
  expected: string
  actual: string
  diff: CharDiffOp[]
  correctChars: number
  totalChars: number
}

export interface WritingAttemptRecord {
  id: string
  session_id: string
  user_id: string
  word_id: string | null
  question_type: WritingQuestionType
  expected_answer: string
  user_answer: string
  pinyin_input: string
  is_correct: boolean
  accuracy: number
  time_taken: number
  mistakes: string
  created_at: string
}

export interface WritingSessionRecord {
  id: string
  user_id: string
  hsk_level: HSKLevel
  scope: WritingScope
  practice_mode: WritingDirection
  order_type: WritingOrder
  question_count: number
  correct_count: number
  accuracy: number
  started_at: string
  completed_at: string | null
}

/** A single answered question inside a running session. */
export interface WritingAnswer {
  questionId: string
  userAnswer: string
  pinyinInput: string
  timeTaken: number
  evaluation: AnswerEvaluation
}

export interface WritingWeakWord {
  label: string
  attempts: number
  correct: number
  accuracy: number
}

export interface WritingStats {
  sessions: number
  questions: number
  correct: number
  accuracy: number
  lastPracticedAt: string | null
}

export interface WritingResultSummary {
  sessionId: string
  totalQuestions: number
  correctCount: number
  accuracy: number
  averageTime: number
  durationSec: number
  weakWords: string[]
  characterMistakes: string[]
}

export interface WritingImeCandidate {
  text: string
  pinyin: string
  frequency: number
  kind: 'char' | 'word' | 'phrase'
}

/** Validated AI-generated sentence exercise. */
export interface SentenceExercise {
  sentence: string
  pinyin: string
  translation: string
  targetWords: string[]
  hskLevel: HSKLevel
}