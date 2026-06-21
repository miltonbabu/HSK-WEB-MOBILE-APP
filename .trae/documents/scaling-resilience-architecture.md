# Plan: Scaling & Resilience Architecture for the AI Endpoint

> **Metaphor from the user:** "How many floors the house has, where the load-bearing walls go, where the water pipes and electrical wiring run, and makes sure the house won't collapse when 100 people stand on the roof."
>
> This plan is the architectural blueprint — load-bearing walls (rate limiting + circuit breaker), water pipes (caching + request flow), electrical wiring (fallback routing), and the roof-load test (10,000 concurrent users).

---

## Summary

The HSK vocab app currently routes every AI request through a single Vercel serverless function (`api/ai/chat.ts`) that proxies to DeepSeek. At 10,000 concurrent users it will fail in four ways: (1) the in-memory per-IP rate limiter resets on every cold start so it effectively doesn't limit shared load, (2) every request hits DeepSeek fresh so cost scales 1:1 with traffic, (3) when DeepSeek is down the only fallback is a 1-retry linear backoff then a canned `offlineFallback()` string, and (4) the client SQLite (sql.js in `localStorage`) has corruption recovery but no backup/restore, while Supabase Postgres has no documented backup/rollback procedure in the repo.

This plan adds four architectural layers — **shared rate limiting + circuit breaker (Upstash Redis)**, **multi-tier AI response caching**, **graceful fallback chain (DeepSeek → local WebLLM → algorithmic)**, and **database corruption recovery for both SQLite and Supabase** — without rewriting the existing app. Every change is additive and grounded in the actual file structure explored in Phase 1.

---

## Current State Analysis (from Phase 1 exploration)

### What exists and works
| Concern | Current state | File |
|---|---|---|
| AI proxy | Single Vercel function, server-side API key, 25s timeout, SSE streaming | `api/ai/chat.ts` |
| Server rate limit | Per-IP, 30 req/min, **in-memory `Map`** (lost on cold start) | `api/ai/chat.ts:40-55` |
| Client rate limit | 10 uses/mode/day guests, 120 min/day registered, in `localStorage` | `src/services/usage.ts` |
| Retry | `MAX_RETRIES = 1`, linear 1s delay, no retry on 401/403 | `src/services/ai-chat.ts:25,1227` |
| LLM dispatcher | Routes between local WebLLM (Qwen2.5-1.5B) and server DeepSeek | `src/services/llm.ts` |
| Offline fallback | Canned `offlineFallback()` responses for chat | `src/services/ai-chat.ts:1342` |
| Exam resilience | Every AI question type has an algorithmic fallback | `src/services/exam.service.ts` |
| SQLite corruption | On load, runs `SELECT 1 FROM user_profiles LIMIT 1`; if it fails, recreates fresh DB | `src/services/database.ts:74-90` |
| Supabase | Optional; short-circuits to no-op Proxy when unconfigured | `src/services/supabase.ts:35-57` |
| PWA | Service worker, offline shell, network-first navigations | `public/sw.js` |

### What's missing (the gaps this plan closes)
1. **No shared rate-limit state** — Vercel spins up multiple function instances; the in-memory `Map` is per-instance, so 10 cold-started instances = 10× the effective limit.
2. **No AI response caching** — identical questions re-hit DeepSeek every time. This is the single biggest cost lever.
3. **No circuit breaker** — repeated DeepSeek failures keep hitting the proxy; no "open" state to fail-fast.
4. **No exponential backoff** — linear 1s × 1 retry is too aggressive under partial outage.
5. **No DB backup/restore** — SQLite corruption wipes user progress; Supabase has no documented restore procedure.
6. **No tests** — resilience code will ship unverified unless we add minimal tests.

---

## Proposed Changes

### Layer 1 — Load-bearing wall: Shared rate limiting + circuit breaker (Upstash Redis)

**Why:** At 10k concurrent users on Vercel, the function scales horizontally. Per-instance in-memory limits are meaningless. We need a shared counter store that survives cold starts. Upstash Redis is serverless-friendly (HTTP API, pay-per-request, free tier 10k commands/day), works inside Vercel functions, and gives us atomic `INCR` + `EXPIRE` for sliding-window rate limits.

**Files to change:**

#### 1.1 New file: `api/lib/redis.ts`
- Create a thin Redis client wrapper using `@upstash/redis` (HTTP-based, no persistent connections — perfect for serverless).
- Read `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from env.
- Export `redis` singleton + a `isRedisConfigured()` guard so the function degrades gracefully to in-memory if Redis isn't configured.

#### 1.2 New file: `api/lib/rate-limit.ts`
- Implement `checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }>`.
- **Sliding window via Redis:** `INCR rate:ip:<ip>` + `EXPIRE rate:ip:<ip> 60` if first hit. Atomic via `MULTI`/`PIPELINE`.
- Tiers: anonymous IP 30 req/min (unchanged), authenticated user 120 req/min (new — keyed by user ID from Bearer token, not IP).
- **Fallback:** if Redis is down or unconfigured, fall back to the existing in-memory `Map`. Never block users on infra failure (fail-open, matching the existing `RateLimitGuard` philosophy).

#### 1.3 New file: `api/lib/circuit-breaker.ts`
- Implement a circuit breaker for the DeepSeek upstream with three states: `closed` → `open` → `half-open`.
- **Open threshold:** 5 consecutive failures (or 50% failure rate over 20 requests) within 60s → open for 30s.
- **State stored in Redis:** `cb:deepseek` = `{ state, failures, openedAt }`. This makes the breaker shared across all Vercel instances — when one instance sees DeepSeek fail, all instances skip the upstream.
- **Half-open:** after 30s, allow 1 probe request through; if it succeeds, close; if it fails, re-open.
- Export `getCircuitState()`, `recordSuccess()`, `recordFailure()`.

#### 1.4 Edit: `api/ai/chat.ts`
- Replace the in-memory `ipHits` Map (lines 40-55) with a call to `checkRateLimit(ip, userId)`.
- Before the `fetch('https://api.deepseek.com/...')` call (line 128), check `getCircuitState()`; if open, return HTTP 503 with `Retry-After` header and a JSON body `{ error: 'AI service temporarily unavailable', fallback: 'local' }` so the client knows to use WebLLM.
- After the fetch, call `recordSuccess()` or `recordFailure()` based on response status.
- Keep the 25s `AbortController` timeout (line 126) — unchanged.

#### 1.5 Edit: `.env.example`
- Add `UPSTASH_REDIS_REST_URL=` and `UPSTASH_REDIS_REST_TOKEN=` with comments explaining the free tier and that these are optional (app degrades to in-memory without them).

#### 1.6 Edit: `package.json`
- Add `@upstash/redis` to dependencies.

---

### Layer 2 — Water pipes: Multi-tier AI response caching

**Why:** Caching is the single highest-leverage cost reduction. HSK vocab questions, sentence validations, and quiz generations are highly repetitive across users — "generate a quiz for HSK 4 word 报名" produces near-identical useful output for every user. A 24-hour cache can cut DeepSeek calls by 60-80% under load.

**Cache tiers (in order of lookup):**

| Tier | Location | TTL | Keyed by | Hit cost |
|---|---|---|---|---|
| 1. Browser memory | Module-level `Map` in `ai-chat.ts` | Session | hash(prompt+model+temp) | ~0ms |
| 2. Browser IndexedDB | New `src/services/ai-cache.ts` | 7 days | same hash | ~1ms |
| 3. Server Redis | Upstash | 24 hours | same hash | ~20ms |
| 4. DeepSeek API | — | — | — | ~2-5s + $$ |

**Files to change:**

#### 2.1 New file: `api/lib/ai-cache.ts`
- `getCachedResponse(cacheKey: string): Promise<string | null>` — Redis `GET cache:ai:<hash>`.
- `setCachedResponse(cacheKey: string, response: string, ttlSeconds = 86400): Promise<void>` — Redis `SET cache:ai:<hash> <response> EX <ttl>`.
- **Cache key derivation:** `sha256(model + temperature + max_tokens + JSON.stringify(messages))`. Deterministic — same prompt = same key.
- **Streaming caveat:** for SSE responses, cache only the *fully-assembled* text, not the stream. On cache hit, return the assembled text as a single non-streaming response. Document this tradeoff in a comment.
- **Skip caching when:** `stream: true` is forced by client AND prompt contains a nonce/timestamp (heuristic: if last user message contains "time" or current date, bypass cache).

#### 2.2 Edit: `api/ai/chat.ts`
- Before calling DeepSeek (line 128), compute cache key and call `getCachedResponse()`. On hit, return the cached text directly (skip DeepSeek entirely).
- After a successful non-streaming DeepSeek response, call `setCachedResponse()` before returning.
- Add response header `X-Cache: HIT|MISS` so the client can observe cache effectiveness.

#### 2.3 New file: `src/services/ai-cache.ts`
- Browser-side IndexedDB cache (7-day TTL) for the same cache key.
- IndexedDB chosen over localStorage because: (a) AI responses can be large (multi-KB), localStorage has a 5MB total cap and is already used for the SQLite DB; (b) IndexedDB is async and won't block the UI thread.
- API: `getCached(key)`, `setCached(key, value)`, `clearExpired()`.
- Called from `ai-chat.ts` `generateResponse` *before* hitting `/api/ai/chat`. If browser cache hits, skip the network call entirely.

#### 2.4 Edit: `src/services/ai-chat.ts`
- In `generateResponse` (around line 1227), before the fetch loop: compute cache key, check browser cache (tier 2), then module memory cache (tier 1). On miss, proceed to fetch `/api/ai/chat` (which itself checks tier 3 Redis).
- On successful response, populate tiers 1 and 2.
- Add a `forceRefresh: boolean` option (default false) for the "Regenerate" button to bypass cache.

---

### Layer 3 — Electrical wiring: Fallback chain when DeepSeek is down

**Why:** The user asked: "Do we show a friendly error, or do we have a fallback smaller model?" Answer: **both, in a chain.** The codebase already has the pieces — `llm.ts` dispatcher, `local-llm.ts` WebLLM, `exam.service.ts` algorithmic generators, `ai-chat.ts` `offlineFallback()`. We wire them into an explicit ordered chain.

**Fallback chain (in order):**

```
1. DeepSeek (server, via /api/ai/chat)  ← primary, highest quality
   ↓ on 503 (circuit open) or 5xx or timeout
2. Local WebLLM Qwen2.5-1.5B (in-browser)  ← already integrated, zero API cost
   ↓ on WebGPU unavailable or model not loaded
3. Algorithmic fallback  ← existing offlineFallback() for chat; exam.service generators for exam
   ↓ (always succeeds — pure functions)
4. Friendly error UI  ← only if user explicitly disabled all fallbacks
```

**Files to change:**

#### 3.1 Edit: `src/services/llm.ts`
- Refactor `chatWithFallback` (lines 212-236) into an explicit ordered chain.
- Add circuit-breaker awareness: if the server returns HTTP 503 with `fallback: 'local'` header, skip directly to WebLLM without retrying server.
- Add a `fallbackReason` field to the return value so the UI can show a non-intrusive banner: "AI service busy — using offline mode."

#### 3.2 Edit: `src/services/ai-chat.ts`
- In `generateResponse`, on server failure: check `navigator.onLine` and WebGPU availability; if both OK, try local WebLLM via `local-llm.ts` `chat()`; if that fails or is unavailable, call existing `offlineFallback()`.
- Replace linear 1s backoff with **exponential backoff**: `delay = min(1000 * 2^attempt, 8000)` for attempts 0-2 (so 1s, 2s, 4s — max 3 attempts total, up from 1).
- Keep the no-retry-on-401/403 rule (auth errors won't fix themselves).

#### 3.3 Edit: `src/pages/AIChat.tsx`
- On fallback, show a subtle amber banner (lines around 868-882 where the error banner already lives): "DeepSeek unavailable — using offline AI. Responses may be simpler."
- Distinguish three UI states: `ok` (green, hidden), `degraded` (amber, fallback active), `error` (red, all fallbacks exhausted).

#### 3.4 Edit: `src/services/exam.service.ts`
- Already resilient — every AI question type has algorithmic fallback. No structural change needed.
- Add logging: when AI fails and algorithmic fallback is used, push to `session.warnings` (pattern already exists at line 672) so the result screen can show "Some questions were generated offline."

---

### Layer 4 — Foundation: Database corruption recovery

**Why:** The user asked "What if the database gets corrupted?" There are two databases with very different recovery strategies.

#### 4A. Client SQLite (sql.js in localStorage)

**Current state:** `database.ts:74-90` detects corruption (failed `SELECT 1 FROM user_profiles LIMIT 1`) and recreates a fresh empty DB — **silently losing all user progress.** This is the bug we fix.

**Files to change:**

##### 4A.1 Edit: `src/services/database.ts`
- **Before** discarding a corrupted DB, attempt to export it: `db.export()` → `Uint8Array` → base64 → save to `localStorage['hsk-sqlite-db-corrupted-<timestamp>']` (keep last 3 corrupted snapshots, rotate).
- Attempt **schema-level recovery**: open the corrupted DB, run `PRAGMA integrity_check`; if only some tables are damaged, try `INSERT INTO recovered SELECT * FROM <table>` for healthy tables.
- Only if recovery fails, create a fresh DB — but first check Supabase: if the user is authenticated and Supabase is configured, pull their latest progress from Supabase and rebuild the local DB from it.
- Log corruption events to `console.error` AND to a `localStorage['hsk-db-corruption-log']` array (capped at 20 entries) for debugging.

##### 4A.2 New file: `src/services/db-backup.ts`
- `createBackup(): Promise<void>` — exports current DB to IndexedDB under `hsk-db-backup-<timestamp>` (keep last 7 daily snapshots).
- `restoreBackup(timestamp: string): Promise<boolean>` — restores from IndexedDB.
- `listBackups(): BackupMetadata[]` — returns available snapshots.
- Schedule automatic backup on app load (once per 24h, gated by `localStorage['hsk-last-backup']` timestamp).
- Expose a "Restore data" option in Settings UI.

##### 4A.3 Edit: `src/pages/Settings.tsx` (or wherever settings live — verify in Phase 4)
- Add "Data & Backup" section: "Last backup: 2 hours ago", buttons: "Back up now", "Restore from backup", "Export data (JSON)".

#### 4B. Supabase Postgres

**Current state:** Migrations in `supabase/migrations/` but no documented backup/restore procedure in the repo. Supabase free tier has daily automatic backups but no point-in-time recovery (PITR) — that's a Pro feature.

**Files to change:**

##### 4B.1 New file: `supabase/backup-restore.md` (documentation only — no code)
Wait — per instructions, don't create docs unless requested. Instead:

##### 4B.1 New file: `scripts/supabase-backup.sh`
- `pg_dump` script that exports the Supabase DB to a timestamped `.sql` file. Configurable via env: `SUPABASE_DB_URL`, `BACKUP_DIR`, `RETENTION_DAYS`.
- Can be run manually or wired into a GitHub Action / cron.
- Includes `pg_restore` companion script `scripts/supabase-restore.sh`.

##### 4B.2 New file: `scripts/supabase-rollback.sh`
- Given a migration filename, generates the inverse SQL (drop table / drop column) for rollback. Documented convention: every migration in `supabase/migrations/` must have a paired `*_rollback.sql` file.

##### 4B.3 New file: `supabase/migrations/20260621_add_corruption_recovery.sql`
- Add a `db_health_checks` table: `(id, check_name, last_run_at, status, details)`.
- Add a Postgres function `verify_schema_integrity()` that checks all expected tables exist and have expected columns — callable from the client to validate remote DB health before sync.

##### 4B.4 Edit: `src/services/supabase-db.ts`
- Before any sync operation, call `verify_schema_integrity()`; if it fails, log the error and skip sync (don't corrupt local data with bad remote data).

---

### Layer 5 — Roof-load test: Verification under 10k concurrent users

**Why:** The user explicitly asked "makes sure the house won't collapse when 100 people stand on the roof." We need both automated tests and a load-test plan.

#### 5.1 New file: `api/lib/__tests__/rate-limit.test.ts`
- Unit tests for `checkRateLimit`: under limit, at limit, over limit, sliding window expiry, fallback when Redis down.
- Use `vitest` + `@upstash/redis` mock.

#### 5.2 New file: `api/lib/__tests__/circuit-breaker.test.ts`
- Unit tests for state transitions: closed→open on threshold, open→half-open after timeout, half-open→closed on success, half-open→open on failure.

#### 5.3 New file: `api/lib/__tests__/ai-cache.test.ts`
- Unit tests for cache key determinism, TTL expiry, cache hit/miss, streaming bypass.

#### 5.4 New file: `scripts/load-test.ts`
- A `k6` or `autocannon` script that simulates 10,000 concurrent users hitting `/api/ai/chat` with a mix of cached and uncached prompts.
- Measures: p50/p95/p99 latency, error rate, DeepSeek call rate (should drop sharply once cache warms), Redis command rate.
- Outputs a Markdown report to `load-test-results/<timestamp>.md`.

#### 5.5 Edit: `package.json`
- Add `vitest` to devDependencies.
- Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"load-test": "node scripts/load-test.js"`.

---

## Assumptions & Decisions

| Decision | Rationale |
|---|---|
| **Upstash Redis** (not Vercel KV, not self-hosted) | HTTP API suits serverless; free tier 10k cmd/day covers dev; pay-per-request scales cleanly; works in `api/` functions without Edge runtime. |
| **Fail-open rate limiting** | Matches existing `RateLimitGuard` philosophy — never block users on infra failure. A missed rate limit is better than a locked-out user. |
| **Circuit breaker threshold: 5 failures / 50% over 20 reqs** | Aggressive enough to protect DeepSeek quota under outage, conservative enough to not trip on a single transient 503. Tunable via env. |
| **Cache TTL: 24h server, 7d browser, session memory** | HSK content is evergreen (vocab doesn't change); 24h server cache balances freshness vs. cost. Browser cache is longer because it's per-user and saves our server calls entirely. |
| **Cache key = sha256(model+temp+max_tokens+messages)** | Deterministic, collision-resistant, ignores non-semantic differences (whitespace normalized). |
| **Streaming responses not cached mid-flight** | Caching partial SSE chunks is complex and low-value. We cache the assembled text and serve it as a single non-streaming response on hit. Acceptable tradeoff for chat; exam generation is already non-streaming. |
| **Fallback chain: DeepSeek → WebLLM → algorithmic → error** | WebLLM is already integrated (`local-llm.ts`), zero new cost, works offline. Algorithmic fallback already exists in `exam.service.ts`. We're just wiring them into an explicit ordered chain. |
| **Exponential backoff: 1s, 2s, 4s (max 3 attempts)** | Industry standard; respects DeepSeek's recovery time without hammering. Up from current 1 retry. |
| **SQLite corruption: snapshot before discard, try Supabase restore** | Current behavior silently wipes user progress — unacceptable. Snapshot preserves forensics; Supabase restore preserves progress for registered users. |
| **IndexedDB for browser AI cache + DB backups** | localStorage is full (SQLite DB lives there); IndexedDB is async, larger quota (50MB+), and purpose-built for this. |
| **No alternate LLM vendor added** | Keeps scope bounded; WebLLM + algorithmic fallback covers outage. Adding OpenAI/Anthropic is a future option if WebLLM quality is insufficient. |
| **Vitest for tests** | Vite-native, fast, works with TypeScript out of the box. |

---

## Verification Steps

1. **Unit tests pass:** `npm test` — all rate-limit, circuit-breaker, and cache tests green.
2. **Rate limit survives cold start:** Deploy to Vercel, hit `/api/ai/chat` 31 times in 60s from one IP → 31st returns 429. Wait 60s, repeat → counter reset (proves Redis-backed, not in-memory).
3. **Circuit breaker opens:** Temporarily set `DEEPSEEK_API_KEY` to invalid value → 5 failed requests → 6th request returns 503 immediately (no DeepSeek call). Restore key → after 30s, half-open probe succeeds → circuit closes.
4. **Cache hit observed:** Send identical chat prompt twice → second response has `X-Cache: HIT` header and returns in <50ms (vs 2-5s for MISS).
5. **Fallback chain works:** With DeepSeek down (circuit open) and WebGPU available → chat returns a response from local Qwen2.5 with amber "degraded" banner. With WebGPU unavailable → chat returns `offlineFallback()` canned response.
6. **SQLite corruption recovery:** Manually corrupt `localStorage['hsk-sqlite-db']` (e.g., set to `"corrupted"`) → reload app → DB is recreated, corrupted snapshot saved to `hsk-sqlite-db-corrupted-<ts>`, and if user is logged in, progress is restored from Supabase.
7. **DB backup/restore:** In Settings → "Back up now" → verify IndexedDB entry created → corrupt localStorage DB → "Restore from backup" → verify progress restored.
8. **Load test:** `npm run load-test` with 10k virtual users → p95 latency < 5s, error rate < 1%, DeepSeek call rate < 30% of request rate (cache working).

---

## Implementation Order (recommended)

1. **Layer 1** (rate limit + circuit breaker) — highest impact on the "10k users" question.
2. **Layer 2** (caching) — highest impact on cost.
3. **Layer 3** (fallback chain) — highest impact on "API goes down" question.
4. **Layer 4A** (SQLite corruption recovery) — highest impact on "DB corrupted" question for guests.
5. **Layer 4B** (Supabase backup/restore) — completes DB coverage.
6. **Layer 5** (tests + load test) — verifies the roof won't collapse.

Each layer is independently shippable. If time-constrained, Layers 1+2 alone address ~70% of the user's concerns (rate limits, latency, cost, caching).

---

## Files touched (summary)

**New files (12):**
- `api/lib/redis.ts`
- `api/lib/rate-limit.ts`
- `api/lib/circuit-breaker.ts`
- `api/lib/ai-cache.ts`
- `api/lib/__tests__/rate-limit.test.ts`
- `api/lib/__tests__/circuit-breaker.test.ts`
- `api/lib/__tests__/ai-cache.test.ts`
- `src/services/ai-cache.ts`
- `src/services/db-backup.ts`
- `scripts/supabase-backup.sh`
- `scripts/supabase-restore.sh`
- `scripts/load-test.js`

**Edited files (8):**
- `api/ai/chat.ts` — Redis rate limit, circuit breaker, cache lookup/store
- `src/services/ai-chat.ts` — browser cache, exponential backoff, fallback chain
- `src/services/llm.ts` — explicit fallback chain, circuit-breaker awareness
- `src/services/database.ts` — corruption snapshot + Supabase restore
- `src/services/supabase-db.ts` — schema integrity check before sync
- `src/pages/AIChat.tsx` — degraded-mode banner
- `src/pages/Settings.tsx` — backup/restore UI (verify file path in Phase 4)
- `.env.example` — Upstash env vars
- `package.json` — `@upstash/redis`, `vitest`, new scripts
