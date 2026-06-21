# Plan: Visitor Analytics + Math Captcha Protection

## Summary

Add two features to the HSK vocabulary app:
1. **Visitor Analytics** — Track unique visitors by IP hash per day/week/month. One IP = one visitor per day regardless of pages browsed. Admin can view counts and hard-delete all data.
2. **Math Captcha** — Simple self-hosted math captcha (e.g., "3 + 4 = ?") to prevent bots from burning AI tokens. Required for guests before AI chat messages and on the signup form.

---

## Current State Analysis

### Visitor Tracking
- **No visitor analytics exist.** The only analytics is external Baidu Tongji script (`src/components/SEO/BaiduAnalytics.tsx`).
- IPs are used for rate limiting in `api/ai/chat.ts` (30 req/min) and `api/guest/identity.ts` (60 req/min) but are **never persisted** — stored in in-memory `Map`s that reset on cold start.
- The Supabase schema (`supabase/schema.sql`) has 7 tables, none for visitor tracking.
- Serverless functions do NOT access Supabase — all DB access is client-side via Supabase JS client with RLS policies.

### Bot Protection
- **Zero captcha or bot protection exists anywhere.** Grep for `captcha|recaptcha|hcaptcha|turnstile` returns no matches.
- All quota enforcement is client-side only (`usageService` in localStorage, `rateLimitService` in local SQLite) — trivially bypassable by clearing storage.
- The single chokepoint for ALL AI calls is `api/ai/chat.ts` — every AI feature (chat, conversation, grammar, sentence-making, quiz, translation, puzzle) funnels through this one endpoint.
- Guest quota (10 uses per mode per day) is enforced client-side only. A bot can call `/api/ai/chat` directly and bypass it entirely.

### Admin Panel
- Admin pages under `src/pages/admin/` with sidebar nav in `AdminLayout.tsx`.
- `AdminDashboard.tsx` is the only analytics page (basic stats — total users, words, sessions).
- `admin.service.ts` handles all admin API calls with dual Supabase/SQLite paths.
- Routes defined in `App.tsx` lines 217-224, all lazy-loaded under `/admin`.

---

## Proposed Changes

### Part 1: Visitor Analytics

#### 1.1 New Supabase Migration: `supabase/migrations/20260618_visitor_logs.sql`

Create a new `visitor_logs` table to track unique visitors:

```sql
CREATE TABLE IF NOT EXISTS visitor_logs (
  id BIGSERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_visit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  is_guest BOOLEAN DEFAULT true,
  UNIQUE(ip_hash, visit_date)
);

CREATE INDEX idx_visitor_logs_date ON visitor_logs(visit_date DESC);

-- RLS: public can INSERT (visitor tracking is anonymous), admin can SELECT/DELETE
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert visitor logs" ON visitor_logs
  FOR INSERT WITH (true);

CREATE POLICY "Admins can read visitor logs" ON visitor_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete visitor logs" ON visitor_logs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

**Key design:** `UNIQUE(ip_hash, visit_date)` ensures one record per IP per day. The `ON CONFLICT DO NOTHING` upsert pattern handles duplicates silently.

**Privacy:** Only the hashed IP is stored (SHA-256 with a salt), never the raw IP.

#### 1.2 New Serverless Function: `api/visitor/track.ts`

A POST endpoint that records a visitor's IP hash. Called fire-and-forget from the client on app load.

```
POST /api/visitor/track
Body: { isGuest: boolean }
Response: 200 OK (empty body)
```

**Logic:**
1. Extract IP from `x-vercel-ip` header (same trusted pattern as `api/ai/chat.ts`).
2. Hash the IP: `SHA-256(ip + VISITOR_SALT)` → hex string. The salt is `process.env.VISITOR_SALT || 'hsk-visitor-salt-v1'`.
3. Insert into `visitor_logs` with `ON CONFLICT (ip_hash, visit_date) DO NOTHING` — if the IP already visited today, nothing happens.
4. Use Supabase REST API directly via `fetch` (avoid importing `@supabase/supabase-js` in serverless):
   ```
   POST https://[SUPABASE_URL]/rest/v1/visitor_logs
   Headers: apikey, authorization (service role key), Prefer: resolution=ignore-duplicates
   Body: { ip_hash, visit_date: today, first_visit_at: now, user_agent, is_guest }
   ```
5. Same strict CORS allow-list as `api/ai/chat.ts`.
6. Per-IP rate limit: 10 req/min (tracking only needs to be called once per session).

**Environment variables needed:**
- `SUPABASE_URL` — already used client-side as `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never exposed to client

#### 1.3 Client-Side Tracking: Modify `src/components/Layout.tsx`

Add a fire-and-forget visitor tracking call on app mount:

```typescript
useEffect(() => {
  // Track unique visitor (once per session)
  const tracked = sessionStorage.getItem('hsk-visitor-tracked')
  if (tracked) return
  sessionStorage.setItem('hsk-visitor-tracked', '1')

  fetch('/api/visitor/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isGuest: !user || user.isGuest }),
  }).catch(() => {}) // silent fail — tracking is non-critical
}, [user?.isGuest])
```

**Why sessionStorage:** Ensures tracking happens once per browser session, not on every page navigation. A new session (new tab or browser restart) will track again, but the `UNIQUE(ip_hash, visit_date)` constraint prevents duplicate counts for the same day.

#### 1.4 Admin Service Additions: Modify `src/services/admin.service.ts`

Add three new methods to the `adminService` object:

```typescript
// Get visitor counts for today, this week, this month
async getVisitorStats(): Promise<{
  today: number
  thisWeek: number
  thisMonth: number
}>

// Get daily visitor counts for the last N days (for chart)
async getVisitorTrend(days: number): Promise<
  Array<{ date: string; count: number }>
>

// Hard-delete all visitor data
async deleteAllVisitorData(): Promise<void>
```

**Implementation (Supabase path):**
- `getVisitorStats`: Three queries — `COUNT(*) WHERE visit_date = CURRENT_DATE`, `WHERE visit_date >= CURRENT_DATE - 6`, `WHERE visit_date >= date_trunc('month', CURRENT_DATE)`. Or a single RPC.
- `getVisitorTrend`: `SELECT visit_date, COUNT(*) FROM visitor_logs WHERE visit_date >= CURRENT_DATE - N GROUP BY visit_date ORDER BY visit_date`
- `deleteAllVisitorData`: `DELETE FROM visitor_logs`

**Implementation (SQLite fallback path):**
- Create the `visitor_logs` table in local SQLite if it doesn't exist.
- Same queries using `query()` and `run()` from `./database`.

#### 1.5 New Admin Page: `src/pages/admin/AdminAnalytics.tsx`

A new page at route `/admin/analytics` showing:

1. **Three stat cards** at the top:
   - Today's unique visitors
   - This week's unique visitors (last 7 days)
   - This month's unique visitors (last 30 days)

2. **Daily visitors bar chart** — last 14 days, animated horizontal/vertical bars (matching the existing HSK-level chart style in `AdminDashboard.tsx`). Each bar shows the date and unique visitor count.

3. **Danger zone section** — "Delete All Visitor Data" button with confirmation dialog. Calls `adminService.deleteAllVisitorData()`. Shows success toast on completion.

**Data loading:** `useEffect` calls `Promise.all([adminService.getVisitorStats(), adminService.getVisitorTrend(14)])` on mount.

**Styling:** Matches existing admin pages — uses `card` class, gradient accents, `motion` for animations.

#### 1.6 Admin Layout & Routing Updates

**Modify `src/pages/admin/AdminLayout.tsx`:**
- Add "Analytics" to the `sidebarItems` array with a `BarChart3` icon from lucide-react.
- Position it after "Dashboard" and before "Vocabulary".

**Modify `src/App.tsx`:**
- Add lazy import: `const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))`
- Add route: `<Route path="analytics" element={<AdminAnalytics />} />` inside the `/admin` route group.

---

### Part 2: Math Captcha Protection

#### 2.1 New Serverless Function: `api/captcha/challenge.ts`

A GET endpoint that generates a math problem and returns a signed token.

```
GET /api/captcha/challenge
Response: { problem: "3 + 4", token: "encrypted-payload" }
```

**Logic:**
1. Generate two random numbers `a, b` (1-9) and a random operator (`+`, `-`, `×`).
   - For subtraction, ensure `a >= b` (no negative answers).
   - For multiplication, keep numbers small (1-5).
2. Compute the answer.
3. Create an encrypted token containing `{ answer, expiresAt }`:
   ```javascript
   const crypto = require('crypto')
   const key = (process.env.CAPTCHA_SECRET || 'hsk-captcha-secret-v1').padEnd(32).slice(0, 32)
   const iv = crypto.randomBytes(16)
   const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv)
   const payload = JSON.stringify({ answer, expiresAt: Date.now() + 600000 }) // 10 min expiry
   let encrypted = cipher.update(payload, 'utf8', 'hex')
   encrypted += cipher.final('hex')
   const token = iv.toString('hex') + ':' + encrypted
   ```
4. Return `{ problem: "3 + 4", token }`.
5. Same strict CORS allow-list and per-IP rate limit (30 req/min).

**Why encryption, not just HMAC:** The client must not be able to read the answer from the token. AES-256-CBC encryption ensures the answer is only readable by the server (which has the secret key). The token is stateless — no server-side storage needed.

#### 2.2 Modify `api/ai/chat.ts` — Add Captcha Verification for Guests

Add captcha verification before forwarding to DeepSeek:

**Logic:**
1. Check if the request has a `userToken` (Supabase JWT). If yes, the user is authenticated — skip captcha.
2. If no `userToken` (guest), require `captchaToken` and `captchaAnswer` in the request body.
3. Decrypt the token:
   ```javascript
   const [ivHex, encrypted] = captchaToken.split(':')
   const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'))
   let decrypted = decipher.update(encrypted, 'hex', 'utf8')
   decrypted += decipher.final('utf8')
   const { answer, expiresAt } = JSON.parse(decrypted)
   ```
4. Check: `Date.now() < expiresAt` and `parseInt(captchaAnswer) === answer`.
5. If invalid or expired, return `403 { error: 'Captcha verification failed' }`.
6. If valid, proceed to the DeepSeek call.

**Backward compatibility:** If `captchaToken` is missing entirely, return `403` for guests. This forces all guests to solve the captcha before AI calls.

#### 2.3 New Client Component: `src/components/MathCaptcha.tsx`

A React component that displays the math captcha challenge:

```typescript
interface MathCaptchaProps {
  onVerified: (token: string, answer: number) => void
  className?: string
}
```

**Behavior:**
1. On mount, fetches a challenge from `GET /api/captcha/challenge`.
2. Displays: `{problem} = ?` with a number input field.
3. User types the answer and presses Enter or clicks "Verify".
4. If the answer matches the expected value (client-side check — the component computes the answer from the problem string), it calls `onVerified(token, answer)`.
5. If wrong, shows "Try again" and offers a "New problem" button.
6. "New problem" button fetches a fresh challenge.

**Wait — client-side check?** The component can parse the problem string ("3 + 4") and compute the answer to verify the user's input before calling `onVerified`. This is fine because:
- The actual security is server-side (the encrypted token is verified by `api/ai/chat.ts`).
- The client-side check is just for UX (don't send obviously wrong answers).
- The client never has the decryption key, so it can't forge a token.

**Styling:** Compact card with the problem in large text, input field, and verify button. Matches the app's design language (rounded, gradient accents).

#### 2.4 Modify `src/pages/AIChat.tsx` — Add Captcha for Guests

Add captcha gating for guest users before they can send AI messages:

**New state:**
```typescript
const [captchaToken, setCaptchaToken] = useState<string | null>(null)
const [captchaAnswer, setCaptchaAnswer] = useState<number | null>(null)
const [showCaptcha, setShowCaptcha] = useState(false)
```

**Logic:**
1. When a guest user tries to send a message (in `send()`, `handleRegenerate()`, `handleEditSave()`):
   - If `isGuest` and `captchaToken` is null → show the captcha overlay.
   - If `isGuest` and `captchaToken` exists → include `{ captchaToken, captchaAnswer }` in the request body.
2. After a successful AI response, keep the captcha token valid for the session (don't require re-verification for every message — the token has a 10-min expiry on the server).
3. If the server returns 403 (captcha invalid/expired), clear the token and show the captcha again.

**Where to render the captcha:**
- As an overlay/modal above the chat input when `showCaptcha` is true.
- Or inline in the input area, replacing the send button with the captcha component until verified.

**Recommended approach:** Show the captcha inline in the input area for guests who haven't verified yet. Once verified, replace it with the normal chat input. The token is stored in state and sent with each AI request.

#### 2.5 Modify `src/services/ai-chat.ts` — Pass Captcha Data

The `generateResponse` function (and other AI functions: `validateSentenceWithAI`, `generateAIQuizQuestions`, `evaluateTranslationWithAI`, `generatePuzzleWithAI`) need to accept and pass captcha data:

```typescript
interface AICallOptions {
  captchaToken?: string
  captchaAnswer?: number
}

// In the fetch body:
body: JSON.stringify({
  messages,
  stream,
  temperature,
  max_tokens,
  ...(options.captchaToken && {
    captchaToken: options.captchaToken,
    captchaAnswer: options.captchaAnswer,
  }),
})
```

All functions that call `/api/ai/chat` should accept an optional `options` parameter and pass it through. The `callAI` helper (line 1042) is the central place to add this.

#### 2.6 Modify `src/pages/Auth.tsx` — Add Captcha to Signup Form

Add a client-side math captcha to the signup form (simpler than server-side since Supabase handles auth):

**Logic:**
1. Generate a random math problem on the client when the signup form renders:
   ```typescript
   const [captchaProblem, setCaptchaProblem] = useState('')
   const [captchaAnswer, setCaptchaAnswer] = useState(0)
   const [captchaInput, setCaptchaInput] = useState('')

   function generateCaptcha() {
     const a = Math.floor(Math.random() * 8) + 1
     const b = Math.floor(Math.random() * 8) + 1
     const ops = ['+', '-']
     const op = ops[Math.floor(Math.random() * ops.length)]
     const [x, y] = op === '-' && a < b ? [b, a] : [a, b]
     setCaptchaProblem(`${x} ${op} ${y}`)
     setCaptchaAnswer(op === '+' ? x + y : x - y)
   }
   ```
2. Display the problem and input field below the password field (signup only, not login).
3. In `handleSubmit`, check `parseInt(captchaInput) === captchaAnswer` before calling `signup()`. If wrong, show error and generate a new problem.
4. Generate a new problem on component mount and after each failed attempt.

**Note:** This is client-side only (weaker than server-side) but adds friction for automated signup bots. The main protection remains on the AI chat endpoint.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260618_visitor_logs.sql` | Visitor logs table + RLS policies |
| `api/visitor/track.ts` | Serverless function to record visitor IP hash |
| `api/captcha/challenge.ts` | Serverless function to generate math captcha challenge |
| `src/components/MathCaptcha.tsx` | Reusable math captcha component |
| `src/pages/admin/AdminAnalytics.tsx` | Admin analytics page for visitor stats |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/Layout.tsx` | Add visitor tracking call on mount |
| `src/services/admin.service.ts` | Add `getVisitorStats`, `getVisitorTrend`, `deleteAllVisitorData` |
| `src/pages/admin/AdminLayout.tsx` | Add "Analytics" nav item |
| `src/App.tsx` | Add `/admin/analytics` route |
| `api/ai/chat.ts` | Add captcha verification for guest requests |
| `src/services/ai-chat.ts` | Pass captcha token/answer through to API calls |
| `src/pages/AIChat.tsx` | Show captcha for guests before AI messages |
| `src/pages/Auth.tsx` | Add client-side math captcha to signup form |

## Environment Variables Needed

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Vercel env (server) | Server-side Supabase access for visitor tracking |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (server) | Bypass RLS for visitor log inserts |
| `CAPTCHA_SECRET` | Vercel env (server) | AES encryption key for captcha tokens |
| `VISITOR_SALT` | Vercel env (server) | Salt for IP hashing (privacy) |

Note: `VITE_SUPABASE_URL` already exists client-side. The server-side `SUPABASE_URL` should be set to the same value.

---

## Assumptions & Decisions

1. **IP hashing:** IPs are SHA-256 hashed with a salt before storage. Raw IPs are never persisted. This protects visitor privacy while still allowing unique counting.

2. **One visitor per IP per day:** The `UNIQUE(ip_hash, visit_date)` constraint ensures that even if a visitor browses 50 pages, they're counted once per day. Weekly/monthly counts are the sum of unique daily visitors (an IP that visits on 3 separate days counts as 3 in the weekly total — this is the standard unique-visitor-per-day aggregation model).

3. **SessionStorage for tracking:** The client calls `/api/visitor/track` once per browser session (using `sessionStorage` flag). This prevents redundant API calls on every page navigation. The server-side `ON CONFLICT DO NOTHING` is the real deduplication mechanism.

4. **Captcha token expiry:** 10 minutes. A guest solves the captcha once and can send multiple AI messages within 10 minutes without re-solving. After expiry, the server returns 403 and the client shows a new captcha.

5. **Captcha for guests only on AI chat:** Registered users are authenticated (they have a Supabase JWT) and don't need captcha. The server checks for a JWT first; if present, captcha is skipped.

6. **Signup captcha is client-side:** Since Supabase handles auth and we can't inject server-side captcha verification into Supabase's `signUp` call, the signup captcha is verified client-side. This stops simple form-submission bots but not sophisticated ones. The main protection is on the AI chat endpoint.

7. **SQLite fallback:** The admin service methods will have SQLite fallback paths (like all other admin methods) so the app works in dev mode without Supabase.

8. **No new npm dependencies:** All captcha logic uses Node.js built-in `crypto` module (server-side) and browser-native APIs (client-side). No third-party captcha library needed.

---

## Verification Steps

1. **Visitor tracking:**
   - Visit the site as a guest → check that `visitor_logs` table has a new row with the hashed IP.
   - Browse multiple pages → verify no duplicate rows for the same IP on the same day.
   - Open admin analytics page → verify today's count is 1.
   - Click "Delete All Visitor Data" → verify table is empty.

2. **Captcha on AI chat:**
   - As a guest, go to `/ai` → verify captcha appears before you can send a message.
   - Solve the captcha → verify you can send AI messages.
   - Wait 10+ minutes → verify captcha reappears on next message.
   - As a registered user, go to `/ai` → verify NO captcha is shown.

3. **Captcha on signup:**
   - Go to `/auth?mode=signup` → verify math captcha appears.
   - Enter wrong answer → verify form submission is blocked.
   - Enter correct answer → verify signup proceeds.

4. **TypeScript:** `npx tsc --noEmit` passes with no errors.

5. **Admin analytics:**
   - Navigate to `/admin/analytics` → verify stat cards show correct numbers.
   - Verify the 14-day bar chart renders with correct data.
   - Verify the delete button works and shows confirmation.
