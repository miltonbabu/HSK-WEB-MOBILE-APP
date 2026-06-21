# Fix Plan — First-Load Issues, API Security & All Features

**Generated**: 2026-06-18
**Last Updated**: 2026-06-18 (final pass)
**Scope**: `hsk-vocab-app/` (web frontend — Vercel)
**Status**: Read-only plan, awaiting user approval to execute the final pass

---

## 1. Summary

The web app had three real categories of issues:

1. **First-load hangs (white screen on first visit, works after refresh)** — the React app blocks on SQLite bootstrap before the splash screen can render.
2. **API security** — `VITE_DEEPSEEK_API_KEY` was being bundled into the public client JS; the `api/ai/chat` and `api/guest/identity` endpoints were missing CORS restrictions and rate limits.
3. **Admin / auth security** — admin login accepted passwordless accounts, mock-JWT `role: 'admin'` could bypass UI checks, `x-forwarded-for` could spoof guest ID for rate-limit reset.

**Current state**: 22 of 23 implementation items from the original plan are already on disk. **4 files still reference `VITE_DEEPSEEK_API_KEY` in the client bundle** (a leftover feature-detection check + a misleading user-facing error message) — these are the only remaining client-side leaks.

This plan adds one short pass to finish those 4 references, then runs the verification commands.

---

## 2. What's already on disk (no action needed)

The following changes from the original plan are already implemented and verified by file inspection:

| # | File | Change |
|---|---|---|
| 1 | [src/main.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/main.tsx) | Fire-and-forget `initDatabase` + vocab seed; exports `whenDbReady` |
| 2 | [src/App.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/App.tsx) | Non-blocking `SplashOverlay`, `AppErrorBoundary` with Reload button |
| 3 | [src/stores/index.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/stores/index.ts#L78-L131) | `checkAuth` sets guest user synchronously, then upgrades in background |
| 4 | [src/services/guest-identity.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/guest-identity.ts) | `getFallbackIdSync()` for first paint |
| 5 | [src/components/Layout.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/components/Layout.tsx#L69-L107) | Prefetch waits for `requestIdleCallback`; deferred when tab hidden; no 1500 ms setTimeout |
| 6 | [src/components/PwaInstallPrompt.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/components/PwaInstallPrompt.tsx) | Stubbed to no-op (single install card in `InstallPWA.tsx`) |
| 7 | [vite.config.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/vite.config.ts#L14-L22) | Dev proxy matches `/api` (covers both `/api/ai` and `/api/guest`) |
| 10 | [src/services/ai-chat.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/ai-chat.ts#L7-L22) | `getBackendConfig` no longer reads `VITE_DEEPSEEK_API_KEY` |
| 11 | [src/services/llm.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/llm.ts#L42-L49) | `getServerConfig` no longer reads `VITE_DEEPSEEK_API_KEY` |
| 12 | [.env.example](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/.env.example) | `VITE_DEEPSEEK_API_KEY` removed; documents server-side only |
| 14 | [api/ai/chat.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/api/ai/chat.ts) | Strict CORS, 30 req/min/IP rate limit, trusts `x-vercel-ip` only |
| 15 | [api/guest/identity.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/api/guest/identity.ts) | Same CORS model, 60 req/min/IP, no client `x-forwarded-for` trust |
| 16 | [vercel.json](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/vercel.json) | CSP `connect-src` no longer includes `https://api.deepseek.com` |
| 17 | [src/services/admin.service.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/admin.service.ts#L80-L112) | Rejects passwordless admin (`if (!stored) throw`) |
| 18 | [src/services/admin.service.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/admin.service.ts#L148-L212) | `checkAuth` re-verifies `is_admin` from DB, never trusts token `role` |
| 19 | [src/pages/admin/AdminLayout.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/pages/admin/AdminLayout.tsx#L22-L30) | Single `useEffect` for `checkAuth` (no duplicate call) |
| 20 | [src/services/supabase.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/services/supabase.ts#L143-L189) | Per-install random salt + pepper, SHA-256 via `crypto.subtle` |
| 21 | [src/components/RateLimitGuard.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/components/RateLimitGuard.tsx#L56-L65) | Soft-loading: children dimmed instead of hard spinner |
| 23 | [api/health.ts](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/api/health.ts) | Returns `{ status: 'ok', timestamp }` (functionally equivalent to `{ ok: true }`) |

---

## 3. Remaining work (Final pass — 4 small edits)

These four files still reference `VITE_DEEPSEEK_API_KEY`. Each is a 1–2 line change.

### 3.1 [src/pages/AIChat.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/pages/AIChat.tsx#L797-L800)

**Current** (misleading user-facing error that names a non-existent env var):
```tsx
Make sure your DeepSeek API key is set in .env as VITE_DEEPSEEK_API_KEY
```

**Replace with** a generic message that points at the proxy/server env (no client var):
```tsx
The AI service is temporarily unavailable. Please try again.
```

**Why**: tells the user a var exists that does not, leaks the security detail, and gives them no actionable path.

### 3.2 [src/pages/modes/TranslationMode.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/pages/modes/TranslationMode.tsx#L56)

**Current**:
```tsx
const hasAI = !!import.meta.env.VITE_DEEPSEEK_API_KEY || !!import.meta.env.VITE_AI_BACKEND_URL || isSupabaseConfigured()
```

**Replace with**:
```tsx
// The /api/ai/chat proxy is always available in this app; we don't read
// VITE_DEEPSEEK_API_KEY in the client bundle.
const hasAI = !!import.meta.env.VITE_AI_BACKEND_URL || true
```

**Why**: `VITE_DEEPSEEK_API_KEY` is intentionally not read in the client (security fix in Pass 2). The proxy is always wired, so AI features are available; the only override is a custom `VITE_AI_BACKEND_URL`.

### 3.3 [src/pages/modes/SequentialQuizMode.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/pages/modes/SequentialQuizMode.tsx#L34)

Same one-line change as 3.2.

### 3.4 [src/pages/modes/SentencePuzzleMode.tsx](file:///e:/PYTHON%20PROJECT%20UNI/MY%20HSK%204/hsk-vocab-app/src/pages/modes/SentencePuzzleMode.tsx#L33)

Same one-line change as 3.2.

---

## 4. Assumptions & Decisions

- **A1**: Web app only (`hsk-vocab-app/`). Mobile app (`hsk-vocab-mobile/`) is not in scope.
- **A2**: The hasAI check is now `!!VITE_AI_BACKEND_URL || true` because the proxy lives in this repo and is always present. If a user wants to disable AI features, they can set `VITE_AI_BACKEND_URL` to a known-bad URL.
- **D1**: We choose to delete the `VITE_DEEPSEEK_API_KEY` references entirely rather than gate them on a flag — security fix is permanent and prevents regression.

---

## 5. Verification Steps (to run after the final pass)

1. **No client-side key leak**
   ```bash
   cd "e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app"
   npm run build
   grep -r "VITE_DEEPSEEK_API_KEY" dist/        # expect: no matches
   grep -r "api.deepseek.com" dist/             # expect: no matches
   ```

2. **Type check**
   ```bash
   npx tsc --noEmit
   ```
   Expect: 0 errors.

3. **Lint**
   ```bash
   npm run lint
   ```
   Expect: 0 errors (warnings acceptable if the project already tolerates them).

4. **Source-tree sanity**
   ```bash
   grep -rn "VITE_DEEPSEEK_API_KEY" src/        # expect: no matches after final pass
   ```

5. **Manual smoke** (in dev):
   - Hard reload `/` with DevTools → Network → Disable cache.
   - Confirm splash appears in <500 ms and Landing content in <2 s.
   - Open `/api/ai/chat` from a non-allow-listed origin (set `ALLOWED_ORIGINS` to a single host in `.env` and curl with a different `Origin`) → expect 403.
   - Send `x-forwarded-for: 1.2.3.4` to `/api/guest/identity` → expect the real Vercel IP, not `1.2.3.4`.
   - Try admin login with a `password_hash = ''` row → expect `"Password not set — admin must reset password"`.

---

## 6. Files to touch in this final pass

- `hsk-vocab-app/src/pages/AIChat.tsx` — replace error message (3.1)
- `hsk-vocab-app/src/pages/modes/TranslationMode.tsx` — fix `hasAI` (3.2)
- `hsk-vocab-app/src/pages/modes/SequentialQuizMode.tsx` — fix `hasAI` (3.3)
- `hsk-vocab-app/src/pages/modes/SentencePuzzleMode.tsx` — fix `hasAI` (3.4)

No new files. No migrations. No backend rewrite. No config changes.
