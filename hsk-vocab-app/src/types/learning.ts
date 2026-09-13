import { HSKLevel, HSKVersion } from './index'

export type ContentReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived'
export type Skill = 'vocabulary' | 'reading' | 'listening' | 'writing' | 'speaking'

/** A saved mistake — feeds the mistake notebook + SRS retry loop. */
export interface Mistake {
  id: string
  user_id: string
  question_id: string | null
  word_id: string | null
  skill: Skill
  /** Short display label: the target word or question stem. */
  prompt: string
  user_answer: string
  correct_answer: string
  explanation: string
  mastered: boolean
  created_at: string
  last_retried_at: string | null
  retry_count: number
}

/** One autosave/resume unit for the mock exam. */
export interface ExamAttempt {
  id: string
  user_id: string
  hsk_version: HSKVersion | null
  hsk_level: HSKLevel
  config: Record<string, unknown>
  status: 'in_progress' | 'submitted' | 'timed_out'
  answers: Record<string, string>
  section_times: Record<string, number>
  score: number | null
  section_scores: Record<string, { correct: number; total: number }> | null
  started_at: string
  submitted_at: string | null
  duration_sec: number
}

export interface SkillScore {
  skill: Skill
  score: number
}

/** Result of a diagnostic assessment. */
export interface DiagnosticResult {
  id: string
  user_id: string
  hsk_level: HSKLevel
  overall: number
  skill_scores: SkillScore[]
  weak_words: string[]
  level3_mastery: number | null
  level4_readiness: number | null
  created_at: string
}

/** Compact mistake input for the save path. */
export type NewMistake = Omit<Mistake, 'id' | 'mastered' | 'created_at' | 'last_retried_at' | 'retry_count'>