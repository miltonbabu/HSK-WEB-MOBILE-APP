# HSK 3.0 Platform Upgrade Plan (Levels 1–4, L3 Review + L4 Prep)

## 1. Summary

Upgrade the existing HSK vocabulary app into a production-ready HSK 3.0 learning platform covering Levels 1–4, prioritizing **Level 3 review** and **Level 4 preparation**. All new features reuse the existing vocabulary DB, auth, AI proxy, progress/SRS system, and design system. Nothing is rebuilt from scratch.

**Scope decisions (user-approved defaults):**
- Scope: **Core upgrade** — question engine, HSK3.0 tagging, diagnostic, upgraded mock exam, mistake notebook, reading/writing upgrades, admin content review. Speaking stays on existing browser TTS/ASR (shadowing mode); no new ASR scoring backend. HSK 5–9 out of scope.
- Platform: **Web app only** (`hsk-vocab-app/`). Mobile app (`hsk-vocab-mobile/`) is out of scope — no changes, no parity checks.
- Data model: add nullable `hsk_version` column (`'2.0'`/`'3.0'`) to `words`; tag existing rows after inspecting live data.
- Database: schema changes are committed as SQL migration files under `hsk-vocab-app/supabase/migrations/` (each paired with a `*_rollback.sql` per convention) and applied to the live Supabase project via **Supabase MCP** or the SQL editor; queries and data inspection use Supabase MCP.
- AI: extend the existing DeepSeek proxy (`api/ai/chat.ts` + `backend/server.js`) with typed feature endpoints; no new provider.

## 2. Current State Analysis (from code inspection)

### Stack
- **Web** `hsk-vocab-app/`: Next.js 16 (App Router, webpack), React 19, TypeScript, Tailwind 3, Zustand, Supabase (auth+Postgres+RLS), Upstash Redis, sql.js (local SQLite mirror), Web-LLM optional local model. Deployed on Vercel (`vercel.json`, CSP headers configured).
- **Backend** `backend/`: standalone Express DeepSeek proxy (`server.js`) — mirrors `hsk-vocab-app/api/ai/chat.ts` serverless handler. The Vercel serverless version is the production path (Redis rate limit + cache + circuit breaker + guest captcha).

### Database (Supabase, `hsk-vocab-app/supabase/schema.sql`)
Tables: `words` (hsk_level 1–6, chinese, pinyin, english, pos, example_sentences, audio_url, radical, stroke_count, topic_category), `user_profiles` (is_admin, streak, daily_goal, hsk_level, onboarding), `user_progress` (SRS: mastery_level 0–5, easiness_factor, interval, next_review), `study_sessions`, `leaderboard`, `user_sentences`, `contact_messages`. RLS enabled everywhere; admin policies via `is_admin`. Seed: `seed.sql` (~300/level inserts; english empty in seed, filled elsewhere).
**Gaps vs. spec:** no `hsk_version`, no questions table, no mistakes table, no exam attempts, no content review statuses, no grammar tags.

### Frontend
- Routes (`app/(app)/`): dashboard, learn, vocabulary, plan, me, leaderboard, settings, ai (AI chat tutor), admin/* (analytics, users, vocabulary, messages, settings), mode/* (14 learning modes: flashcard, timed-quiz, sequential-quiz, listening, shadowing, handwriting, translation, sentence-making, sentence-puzzle, story, conversation, smart-review, weak-words, **exam**).
- Existing exam system: `src/services/exam.service.ts` + `src/types/exam.ts` + `src/components/exam/*` — HSK-4-style mock exam (listening/reading/writing sections, hybrid algorithmic + AI generation, 300-pt scoring). This is the foundation to generalize.
- AI: `src/services/llm.ts` (local/server dispatcher), `ai-features.ts` (grammar breakdown etc. via `callLLM`), `ai-cache.ts`, `ai-chat.ts`.
- Progress: `user_progress` SRS + `src/utils/srs.ts`, `progress-sync.service.ts` (guest→user migration, cloud pull).
- Speech: `src/services/speech.service.ts` — Web Speech API TTS (offline, no keys).

### Reusable assets for this upgrade
- `exam.service.ts` hybrid question generation (algorithmic + AI fallback pattern) → generalize into the question engine.
- `callLLM` + Redis-cached proxy → all new AI features.
- `user_progress` SRS + `srs.ts` → weak-word/mistake scheduling.
- Admin layout + RLS admin policies → content review UI.
- Existing design system (Tailwind, Layout, mode views) → all new pages.

## 3. Proposed Changes

### Phase A — Foundation (DB + shared services)

**A1. Database schema** (committed as migration files in `supabase/migrations/`, applied via Supabase MCP):
- Add `hsk_version` column to `words` table: `ALTER TABLE words ADD COLUMN IF NOT EXISTS hsk_version VARCHAR(10) DEFAULT NULL;` + index. Backfill: set `'3.0'` after verifying seed source via Supabase MCP queries (seed files are HSK 3.0-aligned; if unsure, leave NULL and expose a one-off admin tagging script `scripts/tag-hsk-version.cjs`).
- Create new tables via Supabase MCP (all with RLS mirroring existing patterns; user tables keyed by `auth.uid()`, admin policies via `is_admin`):
  - `questions` — id, hsk_version, hsk_level, skill (`vocabulary|reading|listening|writing|speaking`), question_type, difficulty, target_word_ids uuid[], grammar_focus, topic, instructions, content jsonb (passage/audio_url/transcript/pinyin/translation/options/acceptable_answers), correct_answer, explanation, time_limit_sec, tags text[], ai_generated bool, review_status (`draft|pending_review|approved|rejected|archived`), created_by, created_at/updated_at. Indexes: (hsk_version,hsk_level,skill), (review_status), GIN on target_word_ids.
  - `mistakes` — id, user_id, question_id nullable, word_id nullable, skill, user_answer, correct_answer, explanation, mastered bool, created_at, last_retried_at, retry_count. RLS: owner-only + admin read.
  - `exam_attempts` — id, user_id, hsk_version, hsk_level, config jsonb, status (`in_progress|submitted|timed_out`), answers jsonb (autosave), score, section_scores jsonb, started_at, submitted_at, duration_sec. RLS: owner-only. Enables resume/autosave.
  - `diagnostic_results` — id, user_id, hsk_level, skill_scores jsonb, weaknesses jsonb, level3_mastery numeric, level4_readiness numeric, study_plan jsonb, created_at. RLS: owner-only.
- Create `count_words_by_level_version()` SQL function via Supabase MCP (version-aware totals; never hard-code).

**A2. Shared types** — extend `src/types/index.ts` (add `HSKVersion`, content review status union) and `src/types/exam.ts` (generalize `ExamQuestion` → reuse for engine; add `DiagnosticResult`, `Mistake`, `ExamAttempt` types in new `src/types/learning.ts`).

**A3. Question engine service** — new `src/services/question-engine.service.ts`:
- `generateQuestions({version, level, skill, type, count, words})` — refactors the generator logic out of `exam.service.ts` into reusable per-type builders (cloze, match, mcq, reorder, picture, tf, listening-dialogue). `exam.service.ts` becomes a thin wrapper calling the engine (no behavior change to existing exam until Phase C swap).
- `validateQuestion(q)` — field presence, answer key validity, duplicate detection (hash of content), level-vocab check (target words must exist in `words` at ≤ level).
- `checkAnswer(q, userAnswer)` — uses existing `src/utils/answer-match.ts` fuzzy matching + `acceptableAnswers`.
- AI path: `generateQuestionsAI()` via `callLLM` with strict JSON schema + parse/validate/retry-once; marks `ai_generated=true, review_status='pending_review'`.

**A4. Mistake service** — new `src/services/mistakes.service.ts`: save (dedupe by user+question+day), list with filters (level/skill/word), retry, mark mastered; feeds SRS by writing word-level results into existing `user_progress`.

**A5. AI endpoints** — extend the serverless proxy pattern:
- New `api/ai/generate-question.ts` and `api/ai/evaluate-writing.ts` (Vercel handlers, same inline Redis/rate-limit/circuit-breaker style as `api/ai/chat.ts`, reusing its env vars) + thin `app/api/ai/*/route.ts` adapters via `lib/vercel-adapter.ts`.
- Mirror the two endpoints in `backend/server.js` for self-hosted parity.
- Structured JSON schemas + validation + one retry; never expose keys; captcha rule for guest `source:'chat'` unchanged; new endpoints require auth token (no guest AI generation) to control cost.

### Phase B — Learning features (web)

**B1. HSK 3.0 version/level plumbing**
- `useSettingsStore`: add `hskVersion: '2.0'|'3.0'` (default `'3.0'`) + setter; persisted.
- `src/services/sqlite-api.ts` / `supabase-db.ts`: add version filter to word queries; version-aware counts via `count_words_by_level_version()`.
- Vocabulary view (`src/views/Vocabulary.tsx`): version toggle + L1–4 filter chips; “Level 3 Review” and “Level 4 Prep” quick filters (L3 review = words with mastery<3 at level 3; L4 prep = unstarted level-4 words). All totals from DB.

**B2. Mistake notebook** — new route `app/(app)/mistakes/page.tsx` + `src/views/Mistakes.tsx`: list/filter (level, skill, word), retry inline (re-render question via engine), mark mastered, “practice similar” (engine generates same-type questions on same words). Saves via `mistakes.service`.

**B3. Reading practice upgrade** — new route `app/(app)/reading/page.tsx` + `src/views/ReadingMode.tsx` reusing `components/exam` pieces (`ListeningPlayer`-style layout, `ExamQuestionView`): passage MCQ / true-false / cloze / matching / sentence ordering, timed mode, optional pinyin/translation toggles, explanations after submit. Content from question engine (algorithmic first; AI passage generation optional, labeled, cached in `questions` with `pending_review` until approved — but usable immediately in practice mode with an “AI-generated” badge; exam mode uses approved only).

**B4. Writing practice upgrade** — new route `app/(app)/writing/page.tsx` + `src/views/WritingMode.tsx`: reorder (reuse `ReorderInput`), pinyin→character, translation, guided picture writing (reuse `PicturePrompt`). AI evaluation via `api/ai/evaluate-writing`: returns verdict (`correct|acceptable|partial|incorrect|unclear`), corrected version, grammar/vocab notes, follow-up suggestion. Result saved to mistakes when not correct.

**B5. Listening/speaking** — keep existing `ListeningMode`/`ShadowingMode` (Web Speech TTS). Add exam-rule support to listening questions in exam mode: hide transcript/pinyin until submit (already the pattern in exam components). No new ASR backend; speaking scoring stays as-is. (Documented limitation.)

**B6. Diagnostic assessment** — new route `app/(app)/diagnostic/page.tsx` + `src/services/diagnostic.service.ts`:
- Sections: vocabulary, grammar (via cloze/reorder), reading, listening (TTS), writing. ~25 items for L3, ~25 for L4, assembled by the engine from `approved` questions; adaptive between sections (if vocab <60%, serve easier reading set).
- Output: overall + per-skill scores, weak words/grammar, L3 mastery % and L4 readiness %, generated study plan (daily minutes suggestion), saved to `diagnostic_results`, rendered as a report page + “start recommended practice” deep links.
- Disclaimer: “estimate, not an official HSK result.”

**B7. Mock exam upgrade** — `src/views/modes/ExamMode.tsx` + `exam.service.ts`:
- Switch generation to the question engine; add config (version, level 1–4, length, skills, time limit) in `ExamSetup`.
- Autosave/resume: write `exam_attempts` row on start (status `in_progress`), update `answers` jsonb on each answer (debounced), resume prompt on reload, timeout → `timed_out` with auto-submit.
- Post-submit: score/section scores/accuracy/time, per-question review with explanations, weakness summary, “save mistakes” (bulk insert), level-readiness estimate.

**B8. Dashboard & plan** — `src/views/Dashboard.tsx` and `Plan.tsx`: add L3-review progress ring, L4-prep progress ring (from `user_progress` + version-aware word counts), recent mistakes card (top 5), weak-skill chips (from latest diagnostic), recommended next activity, existing streak/daily goal retained.

### Phase C — Admin content review

**C1.** New route `app/admin/content/page.tsx` + `src/views/admin/AdminContent.tsx` (inside existing `AdminLayout`): table of `questions` with filters (level, skill, type, review_status, ai_generated), inline edit (answer key, pinyin, translation, explanation), approve/reject/archive buttons, duplicate warning (same content hash), “invalid” flags from `validateQuestion`. Uses existing admin auth (`admin.service.ts`) and RLS admin policies.

**C2.** Extend `AdminVocabulary.tsx` with `hsk_version` display/edit so admins can curate version tags.

### Phase D — Testing & verification

- No test runner currently exists → add **Vitest** (devDependency) with unit tests for: `question-engine` (generate/validate/checkAnswer per type), `answer-match`, `mistakes.service` dedupe, `diagnostic.service` scoring, exam autosave serialization, version-aware counts.
- Manual verification checklist: build (`next build --webpack`), lint, vocabulary version filter, L3 review/L4 prep filters, diagnostic end-to-end, exam autosave/resume/timeout, mistake retry loop, admin approve/reject flow, guest vs auth rate limits on new AI endpoints.
- Docs: update `.env.example` only if new vars are needed (goal: none — reuse existing).

## 4. Files created / modified (summary)

**Created (code + migration files; DB schema is committed in `supabase/migrations/` and applied via Supabase MCP):**
- `hsk-vocab-app/supabase/migrations/20260914_add_hsk_version.sql`
- `hsk-vocab-app/src/types/learning.ts`
- `hsk-vocab-app/src/services/question-engine.service.ts`, `mistakes.service.ts`, `diagnostic.service.ts`
- `hsk-vocab-app/api/ai/generate-question.ts`, `api/ai/evaluate-writing.ts` + `app/api/ai/generate-question/route.ts`, `app/api/ai/evaluate-writing/route.ts`
- `hsk-vocab-app/app/(app)/mistakes/page.tsx`, `.../reading/page.tsx`, `.../writing/page.tsx`, `.../diagnostic/page.tsx`
- `hsk-vocab-app/src/views/Mistakes.tsx`, `ReadingMode.tsx`, `WritingMode.tsx`, `DiagnosticMode.tsx`
- `hsk-vocab-app/app/admin/content/page.tsx` + `src/views/admin/AdminContent.tsx`
- `hsk-vocab-app/scripts/tag-hsk-version.cjs`
- `hsk-vocab-app/vitest.config.ts` + tests under `src/**/*.test.ts`

**Modified:**
- `src/types/index.ts`, `src/types/exam.ts`
- `src/services/exam.service.ts` (wrap engine; autosave/resume)
- `src/services/sqlite-api.ts`, `supabase-db.ts` (version filters/counts)
- `src/stores/index.ts` (hskVersion setting)
- `src/views/Vocabulary.tsx`, `Dashboard.tsx`, `Plan.tsx`, `modes/ExamMode.tsx`, `admin/AdminVocabulary.tsx`
- `backend/server.js` (mirror 2 endpoints)
- `src/components/Layout.tsx` (nav links for mistakes/reading/writing/diagnostic)

## 5. Assumptions & Decisions

1. **Scope = core upgrade**; speaking ASR scoring and HSK 5–9 excluded (documented as known limitations).
2. `hsk_version` added as nullable column; existing words presumed HSK 3.0-aligned but backfill happens only after a quick data check — never silently overwrite.
3. AI generation reuses the existing DeepSeek proxy + Redis cache; new AI endpoints are auth-only; structured JSON validated server-side; AI content is labeled and gated by review status for exam use (practice mode may show with badge).
4. No changes to auth, RLS pattern, CSP, or deployment (Vercel). No new env vars planned.
5. Existing user data untouched; all schema changes are additive and idempotent (IF NOT EXISTS), committed as migration files and applied via Supabase MCP against the live project.
6. Vitest added as the first test runner (spec requires tests; none exist today).
7. **Web app only** — `hsk-vocab-mobile/` is out of scope and untouched.

## 6. Risks & Mitigations

- **Seed data has empty `english`** in `seed.sql` — verify live DB actually has english meanings before relying on English-facing question types; if missing, English-side questions fall back to pinyin/Chinese and an admin data-fix script is provided.
- **Supabase MCP writes are live** — apply schema changes in reviewable steps; use `IF NOT EXISTS` so re-runs are safe; verify each change by querying the live schema after applying.
- **AI cost/abuse** — auth-only generation, existing Redis rate limits + circuit breaker + 24h cache reused.
- **Exam behavior regressions** — `exam.service.ts` refactor keeps public API; manual exam checklist before ship.

## 7. Verification steps (final)

1. `npm run build` (Next 16 webpack) passes; `next lint` clean; `tsc --noEmit` clean.
2. `npx vitest run` green.
3. Schema changes applied via Supabase MCP verified against the live project; RLS verified with non-admin and admin users.
4. Manual pass: diagnostic → mistakes → retry → exam autosave/resume → admin approval flow.
