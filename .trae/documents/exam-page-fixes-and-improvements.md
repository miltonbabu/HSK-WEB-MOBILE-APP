# Exam Page (`/mode/exam`) — Fixes & Improvements Plan

## Summary

A thorough review of the HSK 4 Mock Exam feature uncovered **2 critical bugs**, **4 UX issues**, and **5 robustness gaps**. This plan addresses all of them (excluding the writing-reorder token-level fix, which the user chose to skip).

All file paths are grounded in the actual codebase explored during planning.

---

## Current State Analysis

The exam feature was recently rewritten to use **streaming section-by-section generation** (`ExamSession`, `generateNextSection`). The flow is: setup → listening section (generated upfront) → transition → reading → transition → writing → result. Background prefetch prepares the next section while the user answers.

The architecture is sound, but several bugs and gaps remain:

### Critical bugs found
1. **`ExamSectionRunner` doesn't reset question index on section change** — `ExamMode.tsx` renders `<ExamSectionRunner section={section} />` without a `key` prop. When `section` changes (listening → reading), React reuses the component instance, so `useState(0)` for `current` is NOT re-initialized. The user starts the reading section on whatever question index they were on in listening. If reading has fewer questions, `section.questions[current]` is `undefined` → crash or blank screen.
2. **Skipped questions counted as "answered"** — `handleSkip` calls `onAnswer(question.id, '')` (empty string). `answers.has(q.id)` returns `true` for empty strings, so the question palette shows skipped questions as green (answered) and the header's `answeredCount` is inflated. `skippedCount` only counts never-visited questions, which is misleading.
3. **Timer expiry loses in-progress selection** — When `ExamTimer` fires `onExpire` → `onFinishSection`, the user's current `selected` option in `ExamQuestionView` is local state and is lost. The question is graded as blank even though the user had selected an answer.

### UX issues found
4. **`ExamSetup` progress message is stale** — Text says "Audio, images, and questions are all loaded up front" but streaming only loads the listening section upfront. The progress bar's `done/3` fallback assumes 3 sections but only 1 is generated at start.
5. **`ExamResult` review is incomplete** — For listening questions, `audioText` and `statement` are not shown. For `listening-tf` and `writing-picture`, the `imageUrl` is not shown. Users can't review what they heard or saw.
6. **`ListeningPlayer` uses estimated duration** — `setTimeout` based on `text.length / 2.5` instead of the `SpeechSynthesisUtterance.onend` event. If TTS is slower/faster than estimated, the image reveal timing is wrong (content unlocks too early or too late).
7. **No pause functionality** — Once started, the timer runs continuously. For a practice tool, users should be able to pause (at least in practice mode).

### Robustness gaps found
8. **`callLLM` ignores AbortSignal** — `genAIPassageQuestions`/`genAIPictureQuestions` receive `signal` but don't pass it to `callLLM`. Aborted exams continue making AI API calls, wasting quota.
9. **AI responses not validated** — `JSON.parse` output is cast without checking required fields. Malformed AI output → `undefined` fields → runtime crash when rendering.
10. **Blob URLs never revoked** — `prefetchExamImages` creates blob URLs via `URL.createObjectURL`. `handleRetake` doesn't call `URL.revokeObjectURL`. Memory leak across retakes.
11. **No image fetch timeout** — `fetch(url)` in `prefetchExamImages` has no timeout. If Pollinations.ai is slow/down, the prefetch hangs indefinitely, blocking exam start/transition.
12. **Listening Part 3 silently dropped on AI failure** — `buildListeningSection` skips Part 3 (20 questions in full exam) if AI fails, with no user notification. The exam is shorter than advertised.

---

## Proposed Changes

### Fix 1: Add `key` prop to `ExamSectionRunner` (CRITICAL BUG)

**File:** `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\pages\modes\ExamMode.tsx` (line ~278)

**What:** Add `key={section.id}` to the `<ExamSectionRunner>` element.

**Why:** Forces React to remount the component when the section changes, resetting `current` to 0.

**How:**
```tsx
<ExamSectionRunner
  key={section.id}
  section={section}
  sectionIndex={sectionIndex}
  ...
/>
```

---

### Fix 2: Distinguish skipped from answered questions (CRITICAL BUG)

**Files:**
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\components\exam\ExamSectionRunner.tsx`
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\pages\modes\ExamMode.tsx`

**What:** Use a sentinel value `'__SKIPPED__'` instead of `''` for skipped answers. Update the palette and header counts to check for non-empty, non-sentinel values.

**Why:** Empty string is indistinguishable from "never visited". A sentinel makes skip state explicit.

**How:**
- In `ExamSectionRunner.handleSkip`: `onAnswer(question.id, '__SKIPPED__')`
- Add helper: `const isAnswered = (qId) => { const a = answers.get(qId); return !!a && a !== '__SKIPPED__' }`
- Use `isAnswered` in palette button styling and header counts.
- In `gradeExam` (exam.service.ts): treat `'__SKIPPED__'` same as empty (already wrong). No change needed since `'__SKIPPED__'.trim() !== correctAnswer`.

---

### Fix 3: Auto-submit selection on timer expiry (CRITICAL BUG)

**Files:**
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\components\exam\ExamSectionRunner.tsx`
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\components\exam\ExamQuestionView.tsx`

**What:** When the timer expires, auto-submit the user's current selection before finishing the section.

**Why:** Prevents losing an answer the user had selected but not yet submitted.

**How:**
- Add `onTimeUp` callback to `ExamQuestionView` that, if `selected` is set and not submitted, calls `submit(selected)`.
- In `ExamSectionRunner`: pass a ref-based handler to `ExamTimer`'s `onExpire` that first triggers auto-submit on the current `ExamQuestionView`, then calls `onFinishSection`.
- Implementation approach: Lift `selected`/`submitted` state OR use an imperative handle. Simplest: add a `timeUp` prop to `ExamQuestionView` that, when set to true, auto-submits if `selected` is not null.

---

### Fix 4: Update `ExamSetup` progress messaging (UX)

**File:** `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\components\exam\ExamSetup.tsx`

**What:** Update the progress card text and bar logic to reflect streaming generation.

**Why:** Current text says "all loaded up front" which is false. Progress bar `done/3` logic is wrong for single-section upfront generation.

**How:**
- Change help text from "Audio, images, and questions are all loaded up front." to "Preparing the listening section so the exam starts without delays. Reading and writing sections generate in the background while you answer."
- Fix progress bar: when `step === 'questions'` and `total === 1`, use `done/1 * 100`. Remove the `done/3` fallback (it was for the old 3-section-upfront model).

---

### Fix 5: Show images and audio text in result review (UX)

**File:** `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\components\exam\ExamResult.tsx`

**What:** In the expanded question review, show:
- `audioText` (with a small replay button) for listening questions
- `statement` for `listening-tf` questions
- `imageUrl` for `listening-tf` and `writing-picture` questions
- `imageOptions` for `listening-mcq` dialogue questions

**Why:** Users can't review listening or picture questions without seeing/hearing the source material.

**How:**
- In the expanded review section, add conditional blocks:
  - If `review.question.audioText`: show it with a "Replay" button (reuse `ListeningPlayer` with `autoPlay={false}`).
  - If `review.question.imageUrl`: render the image (with onError fallback).
  - If `review.question.imageOptions`: render the 3 images in a row, highlight the correct one.
  - If `review.question.statement`: show it in italic.

---

### Fix 6: Use `onend` event for TTS completion (UX)

**Files:**
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\services\speech.service.ts`
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\components\exam\ListeningPlayer.tsx`

**What:** Add an `onEnd` callback option to `speakChinese` that fires when the last chunk finishes speaking (via `SpeechSynthesisUtterance.onend`). Update `ListeningPlayer` to use this instead of the `setTimeout` estimate.

**Why:** Accurate timing — image reveal syncs with actual speech completion, not a rough estimate.

**How:**
- In `speakChinese`: accept `onEnd?: () => void` in options. Attach `u.onend` to the LAST chunk's utterance. When it fires, call `onEnd()`.
- In `ListeningPlayer.handleSpeak`: pass `onEnd` to `speakChinese`. Remove the `setTimeout` duration estimate. Keep a safety timeout (e.g., 30s) as fallback in case `onend` never fires (known Chrome bug).
- Handle chunking: only the last utterance's `onend` triggers the callback.

---

### Fix 7: Add pause functionality for practice mode (UX)

**Files:**
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\components\exam\ExamSectionRunner.tsx`
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\components\exam\ExamTimer.tsx`

**What:** Add a pause/resume button next to the timer. When paused, the timer stops and a "Paused" overlay covers the question area. Only available in practice mode (passed via prop).

**Why:** Practice tools should allow breaks; full mock exam should not (matches real exam conditions).

**How:**
- `ExamTimer` already accepts a `paused` prop — wire it up.
- Add `isPaused` state in `ExamSectionRunner`. Add a pause button (Pause/Play icon from lucide-react).
- When paused: set `paused={true}` on `ExamTimer`, disable question interaction (overlay or `pointer-events: none`).
- Pass `allowPause` prop from `ExamMode` based on `session.length === 'practice'`.

---

### Fix 8: Pass AbortSignal to `callLLM` (ROBUSTNESS)

**Files:**
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\services\ai-features.ts`
- `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\services\exam.service.ts`

**What:** Add optional `signal` parameter to `callLLM`. Pass it through from `genAIPassageQuestions`/`genAIPictureQuestions`.

**Why:** Aborting an exam (retake/navigation away) should cancel in-flight AI calls, not waste API quota.

**How:**
- `callLLM(system, user, opts, signal?)`: pass `signal` to the underlying `chat()` call (check if `chat` supports it — if not, check `AbortController` support in the fetch layer).
- In `genAIPassageQuestions`/`genAIPictureQuestions`: pass `signal` to `callLLM`.

---

### Fix 9: Validate AI response structure (ROBUSTNESS)

**File:** `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\services\exam.service.ts`

**What:** After `JSON.parse`, validate each element has the required fields before using it.

**Why:** Malformed AI output → `undefined` fields → runtime crash in rendering.

**How:**
- In `genAIPassageQuestions`: filter parsed array to elements where `passage`, `question`, `options` (array of ≥2), and `answer` are present and `answer` is in `options`.
- In `genAIPictureQuestions`: filter to elements where `sceneDescription`, `targetWord`, `expectedSentence` are non-empty strings.
- If filtered array is empty, fall back (same as current AI-failure path).

---

### Fix 10: Revoke blob URLs on retake (ROBUSTNESS)

**File:** `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\pages\modes\ExamMode.tsx`

**What:** In `handleRetake`, revoke all blob URLs created by `prefetchExamImages`.

**Why:** Prevents memory leaks across multiple exam retakes.

**How:**
- Track blob URLs: add a `Set<string>` ref `blobUrlsRef` in `ExamMode`.
- After `generateNextSection` returns, scan the new section's questions for blob URLs (URLs starting with `blob:`) and add them to the set.
- In `handleRetake`: iterate the set and call `URL.revokeObjectURL(url)` for each, then clear the set.

---

### Fix 11: Add image fetch timeout (ROBUSTNESS)

**File:** `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\services\exam.service.ts`

**What:** Wrap each image `fetch()` in `prefetchExamImages` with a timeout (15 seconds). If it times out, skip silently (original URL retained as fallback).

**Why:** Prevents a slow/down Pollinations.ai from blocking exam start or section transitions indefinitely.

**How:**
```typescript
const fetchWithTimeout = (url: string, ms: number, signal?: AbortSignal) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  // If external signal aborts, also abort inner
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
  return fetch(url, { signal: controller.signal, mode: 'cors' }).finally(() => clearTimeout(timeout))
}
```
- Replace `fetch(url, { signal, mode: 'cors' })` with `fetchWithTimeout(url, 15000, signal)`.

---

### Fix 12: Notify user when Part 3 is dropped (ROBUSTNESS)

**File:** `e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app\src\services\exam.service.ts`

**What:** When AI fails for listening Part 3, record a flag on the section so the UI can inform the user.

**Why:** Users should know the exam is shorter than advertised (20 fewer questions in full mode).

**How:**
- Add optional `notice?: string` field to `ExamSection` type in `types/exam.ts`.
- In `buildListeningSection`: if `ai.questions.length === 0` and `plan.listeningPassage > 0`, set `notice` on the returned section (but `buildListeningSection` returns questions, not a section — so set it in `generateNextSection` where the section object is assembled).
- Alternative simpler approach: add a `warnings: string[]` to `ExamSession`. In `buildListeningSection`, if Part 3 is dropped, push a warning. In `ExamMode`, after `generateNextSection`, check `session.warnings` and show a toast/banner.
- Display: a small amber banner at the top of the first question in the listening section: "Note: Passage comprehension questions were unavailable for this session. The exam is shorter than usual."

---

## Assumptions & Decisions

1. **Reorder token fix skipped** per user choice — character-level splitting stays as-is.
2. **Pause only in practice mode** — full mock exam stays timed continuously (matches real HSK conditions).
3. **Blob URL tracking** — scan questions for `blob:` prefixed URLs rather than modifying `prefetchExamImages` to return them (less invasive).
4. **Part 3 notification** — use a `warnings` array on `ExamSession` rather than adding fields to `ExamSection` type (keeps type changes minimal).
5. **TTS onend fallback** — keep a 30s safety timeout in case Chrome's `onend` doesn't fire (known bug).
6. **callLLM signal** — depends on whether the underlying `chat()` function supports AbortSignal. If not, the signal is checked after the call returns (current behavior). The plan adds the parameter; if `chat()` doesn't support it, the abort is still checked post-call.

---

## Verification Steps

1. **Fix 1 (key prop):** Start a full exam, answer a few listening questions, finish the section. Verify reading section starts at question 1, not the previous index.
2. **Fix 2 (skip sentinel):** Skip a question, check the palette — skipped question should NOT be green. Header should show correct answered/skipped counts.
3. **Fix 3 (timer auto-submit):** Select an option but don't submit. Wait for timer to expire (or temporarily set duration to 5s for testing). Verify the selected answer is saved, not blank.
4. **Fix 4 (setup text):** Start an exam, verify the progress card text mentions streaming/background generation, not "all up front".
5. **Fix 5 (result review):** Complete an exam, expand a listening question in results — verify audio text, statement, and image are shown. Expand a writing-picture question — verify image is shown.
6. **Fix 6 (TTS onend):** Start a listening question. Verify the image/statement appears exactly when audio finishes, not earlier/later. Test with a long passage.
7. **Fix 7 (pause):** Start a practice exam, click pause — timer stops, question is unclickable. Click resume — timer continues. Verify full mock exam has no pause button.
8. **Fix 8 (abort signal):** Start an exam, immediately click retake. Check network tab — AI calls should be cancelled.
9. **Fix 9 (AI validation):** Temporarily make `callLLM` return malformed JSON. Verify exam doesn't crash — falls back gracefully.
10. **Fix 10 (blob revoke):** Start and retake an exam 3 times. Check browser memory / DevTools — no blob URL accumulation.
11. **Fix 11 (image timeout):** Temporarily block Pollinations.ai (or use a bad URL). Verify exam starts within ~15s, not hanging indefinitely.
12. **Fix 12 (Part 3 notice):** Disable AI (or simulate failure). Start a full exam. Verify a banner appears noting the listening section is shorter.

**Final checks:**
- Run `npm run lint` and `npm run typecheck` (or `tsc --noEmit`) — no new errors.
- Run `npm run build` — Vercel build succeeds.
- Test on mobile viewport — pause button, result review images, and palette are usable.
