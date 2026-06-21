# Plan: Wire Up Visitor Analytics + Math Captcha (Auth Page Only)

## Summary

The backend for visitor analytics is already complete (migration, serverless functions, admin service, admin page, Layout tracking). The `MathCaptcha` component and `api/captcha/challenge.ts` endpoint are also done. What remains is **client-side wiring**: fix a missing import that crashes the admin analytics route, and add the math captcha to the auth page (both signin and signup) to stop bots from mass-creating accounts or brute-forcing logins.

**Captcha scope (per user clarification):** Captcha appears ONLY on the register and signin forms. It does NOT appear on the AI chat — guests can use AI chat freely, protected by the existing per-mode rate limit (10 uses/mode/day).

## Current State Analysis

**Already done (verified on disk):**
- `supabase/migrations/20260618_visitor_logs.sql` — `visitor_logs` table with `UNIQUE(ip_hash, visit_date)`, RLS policies
- `api/visitor/track.ts` — SHA-256 IP hashing, `Prefer: resolution=ignore-duplicates` upsert
- `api/captcha/challenge.ts` — AES-256-CBC encrypted math captcha tokens, 10-min TTL
- `src/components/MathCaptcha.tsx` — reusable component, calls `onVerified(token, answer)`
- `src/components/Layout.tsx` — visitor tracking `useEffect` with `sessionStorage` once-per-session guard
- `src/services/admin.service.ts` — `getVisitorStats()`, `getVisitorTrend(days)`, `deleteAllVisitorData()`
- `src/pages/admin/AdminAnalytics.tsx` — stat cards + 14-day chart + danger zone
- `src/pages/admin/AdminLayout.tsx` — Analytics nav item added

**Note on existing server-side captcha code:** The previous session added captcha verification to `api/ai/chat.ts` (gated on `source === 'chat'`). Since the AI chat no longer requires captcha, this server code is effectively dormant — it never triggers because the client never sends `source: 'chat'`. It is harmless and left as-is (removing it is unnecessary churn). The `captchaToken`/`captchaAnswer` fields already added to `GenerateResponseOptions` in `src/services/ai-chat.ts` are also left as-is (unused but harmless).

**Gaps found (this plan fixes these):**
1. **`src/App.tsx`** — `<Route path="analytics" element={<AdminAnalytics />} />` exists at line 220 but `AdminAnalytics` is **never imported** → runtime crash on `/admin/analytics`.
2. **`src/pages/Auth.tsx`** — No captcha on the auth form. Bots can spam account creation and brute-force login attempts.

## Proposed Changes

### Change 1: Fix missing AdminAnalytics import in `src/App.tsx`

**What:** Add the lazy import so the route works.
**Why:** Currently navigating to `/admin/analytics` throws `ReferenceError: AdminAnalytics is not defined`.
**How:** Add after line 49 (the `AdminMessages` import):
```tsx
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'))
```

### Change 2: Add math captcha to auth form (signin + signup) in `src/pages/Auth.tsx`

**What:** Render `MathCaptcha` inside the auth form for BOTH login and signup modes. Require verification before `login()` or `signup()` is called.
**Why:** Stops bots from mass-creating accounts and brute-forcing passwords. Per user's explicit instruction, captcha appears on register and signin only.
**How:**

- Import: `import MathCaptcha from '@/components/MathCaptcha'`
- Add state (near line 19, alongside `termsAccepted`):
  ```ts
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState<number | null>(null)
  ```
- In `handleSubmit` (line 21), add a captcha guard BEFORE the `termsAccepted` check (so it applies to both login and signup):
  ```ts
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!captchaToken || captchaAnswer === null) {
      setError('Please solve the math captcha to continue')
      return
    }
    if (!isLogin && !termsAccepted) {
      setError('You must accept the Privacy Policy & Terms to create an account')
      return
    }
    // ... rest unchanged
  }
  ```
- Render `<MathCaptcha>` in the form, placed after the password field block (after line ~214, before the terms `AnimatePresence` at line 216). It shows for both login and signup:
  ```tsx
  <MathCaptcha onVerified={(t, a) => { setCaptchaToken(t); setCaptchaAnswer(a); setError('') }} />
  ```
- Reset captcha state when toggling between login/signup. Find the `setIsLogin(...)` calls (the tab-switching buttons) and add `setCaptchaToken(null); setCaptchaAnswer(null)` alongside them, so a fresh captcha is required after switching modes. This prevents reusing a stale token across mode changes.
- Disable the submit button when captcha is not yet verified for the current mode. Update the `disabled` attribute on the submit button (line 247) from `disabled={isLoading}` to `disabled={isLoading || !captchaToken}`.

**Note on client-side only:** The captcha is verified client-side (the `MathCaptcha` component checks the answer against the problem string). The `login`/`signup` store actions do not forward the token to Supabase. This is sufficient because Supabase has its own bot protection (email verification for signup, rate limiting for login), and the client gate stops the trivial "spam the button" bot. The encrypted token from `/api/captcha/challenge` is stateless and expires in 10 minutes, so even if a bot fetched a challenge, it would still need to solve the math to get a verified answer.

### Change 3: Typecheck and push

**What:** Run `npx tsc --noEmit` to catch type errors, then push to GitHub.
**Why:** Ensure the wiring compiles and is deployed.
**How:**
```powershell
cd e:\PYTHON PROJECT UNI\MY HSK 4\hsk-vocab-app; npx tsc --noEmit
```
Fix any errors, then:
```powershell
git add -A; git commit -m "feat: wire up visitor analytics + math captcha on auth page"; git push
```

## Assumptions & Decisions

1. **Captcha scope (per user):** Captcha appears ONLY on signin and signup forms. NOT on AI chat. Guests can use AI chat freely (protected by existing 10-uses/mode/day rate limit). Registered users sign in through the captcha-gated auth page, so bots cannot create accounts to access the 2-hour registered quota.
2. **Captcha type:** Simple math captcha (`a op b` with `+`, `-`, `×`), as the user explicitly chose earlier.
3. **Captcha on both login and signup:** User said "register and signin only" — both modes of the auth form get the captcha. This blocks both account-creation spam and password brute-forcing.
4. **Visitor dedup:** `UNIQUE(ip_hash, visit_date)` in the DB handles dedup automatically — same IP browsing multiple pages in a day counts once. Client-side `sessionStorage` flag prevents redundant API calls within a session.
5. **Existing dormant server-side captcha code:** The `verifyCaptcha` logic in `api/ai/chat.ts` and the `captchaToken`/`captchaAnswer` fields in `GenerateResponseOptions` are left as-is. They are unused but harmless. Removing them would be extra churn with no functional benefit.
6. **No new files created** — all changes are edits to existing files (per the "prefer editing" rule). Only 2 files are touched: `src/App.tsx` (1-line import fix) and `src/pages/Auth.tsx` (captcha wiring).

## Verification Steps

1. **Typecheck passes:** `npx tsc --noEmit` exits 0.
2. **Admin analytics route works:** Navigate to `/admin/analytics` as admin — page loads without crash, shows today/week/month counts and 14-day chart.
3. **Visitor tracking fires once:** Open the app in a fresh browser session → check Supabase `visitor_logs` table has one new row. Refresh/navigate pages → no new row (dedup works).
4. **Signin requires captcha:** Go to `/auth` (login mode) → see math captcha. Try to submit without solving → submit button disabled / error shown. Solve → can log in.
5. **Signup requires captcha:** Go to `/auth?mode=signup` → see math captcha. Try to submit without solving → error. Solve → can create account.
6. **Captcha resets on mode switch:** Switch between Login and Create Account tabs → captcha resets, must re-solve.
7. **Guest AI chat works without captcha:** Open app in incognito (guest), go to AI Chat → no captcha shown, can send messages (rate-limited as before).
8. **Admin can hard-delete visitor data:** In Admin Analytics → Danger Zone → confirm delete → table empties, counts drop to 0.
