# Plan: HSK 4 Mock Exam Mode

## Summary

Add a full HSK 4 mock exam feature to the 学通 (XueTong) app that mirrors the real HSK 4 exam structure (Listening / Reading / Writing sections). Users choose between a **Full Exam** (~100 questions, ~95 min) or a **Practice Exam** (~30 questions, ~25 min). Questions are generated from the **existing 2000 words** — no vocabulary changes. Generation is **hybrid**: algorithmic for most question types (instant, offline), AI-generated for passages/dialogues/pictures (richer quality). Writing-section pictures are generated at runtime via the free Pollinations.ai image API (no API key needed).

## Current State Analysis

- **No exam mode exists.** 13 learning modes live under `/mode/*` routes, each wrapped in `RateLimitGuard`, each with a card in `Learn.tsx`'s `learningModes` array.
- **`LearningMode` type** in [src/types/index.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/types/index.ts) (line 66-79) has no `'exam'` member — must be added.
- **Vocabulary**: 2000 HSK 4 words in `public/hsk_level_4.json`, accessed via `wordService.getByLevel(4)`. Each `Word` has `chinese`, `pinyin`, `english`, `pos`, `example_sentences[]` — enough to build listening/reading/writing questions.
- **TTS**: Web Speech API (`speechSynthesis`) already used in 8 files. Pattern: `new SpeechSynthesisUtterance(text)` with `lang='zh-CN'`. Reusable for listening section.
- **AI service**: [src/services/ai-features.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/ai-features.ts) has `callLLM(systemPrompt, userPrompt, opts)` — reusable for generating passages/dialogues.
- **Answer matching**: [src/utils/answer-match.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/utils/answer-match.ts) `isAnswerCorrect()` — fuzzy matching for text-input questions.
- **Drag-and-drop reorder**: `SentencePuzzleMode` already implements word reordering — pattern reusable for Writing Part 1.
- **Phase flow**: `TimedQuizMode` uses `setup → playing → result` phase pattern — reusable for exam flow.
- **Leaderboard**: `leaderboardService.addEntry()` exists for submitting scores.

## Proposed Changes

### 1. New types — `src/types/exam.ts` (NEW)

Exam-specific types, kept separate from `index.ts` to avoid bloat:

```typescript
export type ExamLength = 'full' | 'practice';
export type ExamSectionId = 'listening' | 'reading' | 'writing';
export type ExamQuestionType =
  | 'listening-tf'        // Part 1: true/false on spoken statement
  | 'listening-mcq'       // Part 2/3: MCQ on spoken dialogue/passage
  | 'reading-cloze'       // Part 1: fill blank from word bank
  | 'reading-match'       // Part 2: match Chinese↔English sentences
  | 'reading-mcq'         // Part 3: MCQ on reading passage
  | 'writing-reorder'     // Part 1: reorder shuffled sentence
  | 'writing-picture';    // Part 2: write sentence about picture using given word

export interface ExamQuestion {
  id: string;
  section: ExamSectionId;
  type: ExamQuestionType;
  prompt: string;              // visible prompt text (English instruction)
  audioText?: string;          // text to speak via TTS (listening section)
  passage?: string;            // reading passage (reading-mcq) or dialogue (listening-mcq)
  imageUrl?: string;           // generated picture URL (writing-picture)
  targetWord?: string;         // required word for writing-picture
  options?: string[];          // MCQ options
  correctAnswer: string;       // canonical correct answer
  acceptableAnswers?: string[];// for text-input fuzzy matching
  shuffledWords?: string[];    // for writing-reorder
  word: Word;                  // source word for SRS tracking
}

export interface ExamSection {
  id: ExamSectionId;
  name: string;
  nameCn: string;
  questions: ExamQuestion[];
  durationSec: number;
}

export interface ExamResult {
  totalQuestions: number;
  correctCount: number;
  score: number;               // out of 300 (3 pts per question)
  passed: boolean;             // score >= 180 (60%)
  sectionResults: Record<ExamSectionId, { correct: number; total: number; timeTakenSec: number }>;
  durationSec: number;
  questionReviews: { question: ExamQuestion; userAnswer: string; correct: boolean }[];
}
```

### 2. Extend `LearningMode` — `src/types/index.ts` (EDIT)

Add `'exam'` to the `LearningMode` union (line 66-79):
```typescript
export type LearningMode =
  | 'listening' | 'flashcard' | 'timed-quiz' | 'sequential-quiz'
  | 'visual' | 'sentence-making' | 'sentence-puzzle' | 'translation'
  | 'shadowing' | 'handwriting' | 'story' | 'conversation'
  | 'smart-review' | 'exam';   // ← add
```

### 3. Exam question generator — `src/services/exam.service.ts` (NEW)

Core service that builds an exam. Two public functions:

```typescript
export async function generateExam(length: ExamLength, level: HSKLevel, signal?: AbortSignal): Promise<ExamSection[]>
export async function gradeExam(sections: ExamSection[], answers: Map<string, string>): Promise<ExamResult>
```

**Question counts:**

| Section | Full | Practice |
|---|---|---|
| Listening Part 1 (T/F) | 10 | 4 |
| Listening Part 2 (dialogue MCQ) | 15 | 5 |
| Listening Part 3 (passage MCQ) | 20 | 6 |
| Reading Part 1 (cloze) | 10 | 4 |
| Reading Part 2 (matching) | 10 | 3 |
| Reading Part 3 (passage MCQ) | 20 | 3 |
| Writing Part 1 (reorder) | 5 | 3 |
| Writing Part 2 (picture) | 10 | 2 |
| **Total** | **100** | **30** |

**Section durations:** Full: listening 30min, reading 40min, writing 25min. Practice: 10/10/5 min.

**Algorithmic generators (instant, no AI):**

- `genListeningTF(words)`: Pick a word, TTS speaks its `example_sentences[0]`. Show a statement about it (e.g., "The speaker is asking about ___"). User picks ✓/✗. Correct answer derived from sentence content.
- `genListeningDialogueMCQ(words)`: Build a 2-line dialogue using two words' example sentences. Ask "What does the man/woman mean?" 4 options = 4 words' English meanings.
- `genReadingCloze(words)`: Take `example_sentences[0]`, replace target word with `___`. Options = target + 3 random same-POS words.
- `genReadingMatch(words)`: Show 3 Chinese sentences + 4 English translations (1 distractor). User matches. Each "question" = 1 match (so 10 matches = 10 questions, with ~3 sentences per group).
- `genWritingReorder(words)`: Take `example_sentences[0]`, split on spaces/characters, shuffle. User reorders. Correct = original sentence.

**AI generators (for richer content, uses `callLLM`):**

- `genListeningPassageMCQ(words)`: Prompt AI to generate a 3-4 sentence Chinese passage using 2-3 HSK 4 words, plus a question + 4 options. Returns JSON. Fallback to algorithmic dialogue MCQ if AI fails.
- `genReadingPassageMCQ(words)`: Same but for reading (passage shown as text, not spoken).
- `genWritingPicture(words)`: Prompt AI to generate `{ sceneDescription, targetWord, expectedSentence }`. Build image URL: `https://image.pollinations.ai/prompt/${encodeURIComponent(sceneDescription)}?width=400&height=300&nologo=true`. User writes a sentence using `targetWord` about the picture. Fuzzy-matched against `expectedSentence` via `isAnswerCorrect()`.

**AI batching strategy:** To avoid 30+ sequential AI calls, batch all AI questions per section into ONE LLM call that returns a JSON array. E.g., one call generates all 20 listening-passage questions. This keeps total AI calls to ~3-4 per exam (one per AI question type). If AI fails or times out, fall back to algorithmic versions.

**Word selection:** Shuffle the 2000 words, slice per section. Track used words to avoid duplicates within an exam.

### 4. Exam page — `src/pages/modes/ExamMode.tsx` (NEW)

Main orchestrator. Phase state machine: `setup → listening → reading → writing → result`.

**Setup phase:**
- Choose exam length (Full / Practice) — two big cards
- Choose HSK level (defaults to `selectedLevel` from store, but exam is designed for HSK 4)
- "Start Exam" button → triggers `generateExam()`, shows loading state while questions build

**Section phases (listening/reading/writing):**
- Top bar: section name, question counter (X/Y), section timer (countdown from `durationSec`), progress bar
- Auto-advance to next section when timer hits 0 OR user clicks "Finish Section"
- Question navigation: prev/next buttons + question palette (grid of numbered buttons, color-coded answered/unanswered)
- Listening section: TTS auto-plays on question load; "Replay" button; for MCQ, show options after audio plays
- Reading section: passage displayed in a scrollable card; cloze shows word bank
- Writing section: reorder uses drag-and-drop (reuse `SentencePuzzleMode` pattern); picture shows `<img>` + target word + text input

**Result phase:**
- Score circle (out of 300), PASS/FAIL badge (≥180 = pass)
- Section breakdown bars (listening/reading/writing % correct)
- Time taken
- Question review list (collapsible): shows each question, user answer, correct answer, ✓/✗
- Buttons: "Retake Exam", "Back to Learn", "Submit to Leaderboard"
- Calls `recordStudySession()` + `leaderboardService.addEntry()` with mode `'exam'`

### 5. Exam sub-components — `src/components/exam/` (NEW directory)

Split for maintainability:

- `ExamSetup.tsx` — length/level selection UI
- `ExamSectionRunner.tsx` — section header (timer, progress, palette) + renders current question
- `ExamQuestionView.tsx` — switches on `question.type`, renders appropriate input
- `ListeningPlayer.tsx` — TTS playback with replay button (extracts pattern from `ListeningMode`)
- `ReorderInput.tsx` — drag-and-drop word ordering (extracts pattern from `SentencePuzzleMode`)
- `PicturePrompt.tsx` — shows generated image + target word + text input
- `ExamResult.tsx` — score display + review
- `ExamTimer.tsx` — countdown timer hook/component with auto-advance

### 6. Route + nav integration

**`src/App.tsx` (EDIT):** Add route after the smart-review route (line ~210):
```tsx
<Route path="/mode/exam" element={<RateLimitGuard modeId="exam" modeName="HSK Mock Exam"><ExamMode /></RateLimitGuard>} />
```
Add lazy import: `const ExamMode = lazy(() => import('@/pages/modes/ExamMode'))`

**`src/pages/Learn.tsx` (EDIT):** Add exam card to `learningModes` array (after smart-review, line 129). Make it visually prominent — placed first or with a distinct "Exam" badge:
```javascript
{
  id: 'exam',
  name: 'HSK 4 Mock Exam',
  description: 'Full mock exam: listening, reading & writing',
  icon: GraduationCap,   // from lucide-react
  path: '/mode/exam',
  colors: ['#ef4444', '#dc2626'],   // red = exam
  shadow: 'rgba(239,68,68,0.3)',
},
```
Add `GraduationCap` to the lucide-react import on line 8.

### 7. SEO metadata — `src/utils/seo.ts` (EDIT)

Add `exam` entry to `PAGE_SEO`:
```typescript
exam: {
  title: 'HSK 4 Mock Exam — Listening, Reading & Writing | 学通',
  description: 'Take a full HSK 4 mock exam with listening, reading, and writing sections. Timed, scored, and aligned with the real HSK 4 test format.',
  keywords: ['HSK 4 mock exam', 'HSK practice test', '汉语水平考试', 'HSK listening', 'HSK reading', 'HSK writing'],
},
```

## Assumptions & Decisions

1. **Vocabulary unchanged** — exam uses existing 2000 HSK 4 words via `wordService.getByLevel(4)`. No new data files.
2. **Pollinations.ai for pictures** — free, no API key, URL-based: `https://image.pollinations.ai/prompt/{prompt}?width=400&height=300&nologo=true`. If it fails, fallback to text-only scene description (no image, just "Scene: a man eating in a restaurant").
3. **AI batching** — one LLM call per AI question type per exam (not per question). ~3-4 AI calls total. Falls back to algorithmic if AI fails or user is offline.
4. **Rate limiting** — exam counts as ONE mode use against the guest rate limit (10/day), not per-question. Reuses `RateLimitGuard` with `modeId="exam"`.
5. **Scoring** — 3 points per question, 300 total, pass = 180 (60%). Matches real HSK 4 passing threshold.
6. **TTS for listening** — reuses Web Speech API. User can replay audio. No pre-recorded files.
7. **No backend changes** — all generation happens client-side (algorithmic) or via existing `/api/ai/chat` proxy (AI questions). No new serverless endpoints needed.
8. **HSK 4 focus** — while the setup allows level selection, the exam is designed for HSK 4. Lower levels work but questions may be easier.
9. **Offline support** — algorithmic questions work offline. AI questions fall back to algorithmic when offline. Service worker already caches app shell.

## Verification Steps

1. **Build check**: `npm run build` passes with no TS errors (new types, no unused vars)
2. **Dev server**: `npm run dev` → navigate to `/learn` → see "HSK 4 Mock Exam" card → click → setup page renders
3. **Practice exam flow**: Start practice exam → all 3 sections complete → result page shows score + review
4. **Full exam flow**: Start full exam → 100 questions generate (may take 5-10s for AI questions) → complete → result
5. **Listening TTS**: Audio plays on listening questions, replay button works
6. **Writing reorder**: Drag-and-drop works, correctly ordered sentence accepted
7. **Writing picture**: Image loads from Pollinations.ai, text input accepts answer, fuzzy match works
8. **Timer**: Section timer counts down, auto-advances at 0
9. **Leaderboard**: Score submits to leaderboard with mode `'exam'`
10. **Offline**: Algorithmic questions work offline; AI questions fall back gracefully
11. **Mobile**: Layout responsive on phone (bottom nav hidden during exam for focus)
12. **Dark mode**: All components have dark mode styles

## Files Summary

| File | Action | Purpose |
|---|---|---|
| `src/types/exam.ts` | NEW | Exam type definitions |
| `src/types/index.ts` | EDIT | Add `'exam'` to `LearningMode` |
| `src/services/exam.service.ts` | NEW | Question generation + grading |
| `src/pages/modes/ExamMode.tsx` | NEW | Main exam orchestrator page |
| `src/components/exam/ExamSetup.tsx` | NEW | Length/level selection |
| `src/components/exam/ExamSectionRunner.tsx` | NEW | Section header + question runner |
| `src/components/exam/ExamQuestionView.tsx` | NEW | Question type renderer switch |
| `src/components/exam/ListeningPlayer.tsx` | NEW | TTS playback component |
| `src/components/exam/ReorderInput.tsx` | NEW | Drag-and-drop sentence reorder |
| `src/components/exam/PicturePrompt.tsx` | NEW | Picture + target word + input |
| `src/components/exam/ExamResult.tsx` | NEW | Score + review display |
| `src/components/exam/ExamTimer.tsx` | NEW | Countdown timer hook |
| `src/App.tsx` | EDIT | Add `/mode/exam` route |
| `src/pages/Learn.tsx` | EDIT | Add exam card |
| `src/utils/seo.ts` | EDIT | Add exam SEO entry |
