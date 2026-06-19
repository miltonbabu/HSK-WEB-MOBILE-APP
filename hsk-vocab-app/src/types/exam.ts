import { Word } from './index'

export type ExamLength = 'full' | 'practice'
export type ExamSectionId = 'listening' | 'reading' | 'writing'
export type ExamQuestionType =
  | 'listening-tf'      // Part 1: true/false on spoken statement
  | 'listening-mcq'     // Part 2/3: MCQ on spoken dialogue/passage
  | 'reading-cloze'     // Part 1: fill blank from word bank
  | 'reading-match'     // Part 2: match Chinese to English sentence
  | 'reading-mcq'       // Part 3: MCQ on reading passage
  | 'writing-reorder'   // Part 1: reorder shuffled sentence
  | 'writing-picture'   // Part 2: write sentence about picture using given word

export interface ExamQuestion {
  id: string
  section: ExamSectionId
  type: ExamQuestionType
  prompt: string               // visible instruction text (English)
  audioText?: string           // text to speak via TTS (listening section)
  passage?: string             // reading passage or dialogue transcript
  imageUrl?: string            // generated picture URL (writing-picture)
  targetWord?: string          // required word for writing-picture
  options?: string[]           // MCQ / matching options
  correctAnswer: string        // canonical correct answer
  acceptableAnswers?: string[] // for text-input fuzzy matching
  shuffledWords?: string[]     // for writing-reorder
  word: Word                   // source word for SRS tracking
}

export interface ExamSection {
  id: ExamSectionId
  name: string
  nameCn: string
  questions: ExamQuestion[]
  durationSec: number
}

export interface ExamSectionResult {
  correct: number
  total: number
  timeTakenSec: number
}

export interface ExamQuestionReview {
  question: ExamQuestion
  userAnswer: string
  correct: boolean
}

export interface ExamResult {
  totalQuestions: number
  correctCount: number
  score: number                // out of 300 (3 pts per question)
  passed: boolean              // score >= 180 (60%)
  sectionResults: Record<ExamSectionId, ExamSectionResult>
  durationSec: number
  questionReviews: ExamQuestionReview[]
}
