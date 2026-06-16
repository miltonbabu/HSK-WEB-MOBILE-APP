# Guest/User Rate Limiting + Usage Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-day and total-time rate limiting for learning modes. Guest users get 10 uses per mode per day and 2 hours total per day. Registered/signed-in users get unlimited usage. Track usage locally (SQLite) and optionally sync to Supabase.

**Architecture:**
- Create a `usage_logs` table (local SQLite) that tracks every mode entry with timestamp + duration
- Add a `rateLimitService` that exposes: `getModeUsageCount(modeId)`, `getTotalMinutesToday()`, `recordUsage(modeId)`, `checkLimit(modeId) → { allowed, reason, remaining }`
- Wrap each mode route with a `<RateLimitGuard modeId="...">` that shows a friendly "limit reached" panel if blocked
- Add a usage indicator UI on the Learn page showing remaining daily quota for guests
- Optional: sync usage counts to Supabase so they persist across devices for signed-in users

**Tech Stack:** TypeScript, Zustand, SQLite (sql.js), Framer Motion, React Router

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where to store usage | **Local SQLite** for both guest + signed-in | Simpler, no Supabase schema migration needed, no extra env setup |
| Track per-mode vs total | **Both** — per-mode 10/day + total 120 min/day | User asked for both limits |
| When to start timer | When user enters mode (page mount) → stop on unmount | Reliable, simple |
| Reset timing | **Local midnight** (not server-side) | Avoids timezone complexity; close enough for daily limits |
| Limits for AI modes | Same as regular modes | User said "all features" should have same limits |
| Visual indicator | Pill on each mode card showing `7/10 used` | Helpful UX, makes limits visible |
| Limit-reached UI | Full-screen card with Sign Up / Login CTA | Conversion-focused |

---

## Task 1: Add `usage_logs` table + service

**Files:**
- Modify: `src/services/database.ts` (add table creation)
- Create: `src/services/rate-limit.service.ts`

- [ ] **Step 1: Add `usage_logs` table schema**

In `src/services/database.ts`, inside `initDatabase()` after the `user_profiles` migrations, add:

```typescript
db.run(`
  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    mode_id TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
  )
`);
db.run('CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_logs(user_id, started_at)');
db.run('CREATE INDEX IF NOT EXISTS idx_usage_user_mode_date ON usage_logs(user_id, mode_id, started_at)');
```

- [ ] **Step 2: Create rate limit service**

Create `src/services/rate-limit.service.ts`:

```typescript
import { query, run } from './database'

export interface UsageStats {
  modeUsageCount: number       // count of sessions today in this mode
  modeUsageRemaining: number   // remaining uses for this mode today
  totalSecondsToday: number    // total seconds used today across all modes
  totalMinutesRemaining: number // minutes remaining of 120-min daily cap
  isGuest: boolean
}

export const GUEST_MODE_LIMIT = 10        // 10 uses per mode per day
export const GUEST_DAILY_MINUTES = 120    // 2 hours total per day

const STORAGE_KEY = 'hsk-usage-day'       // tracks current local day for resets

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function checkAndRotateDay(): void {
  const today = getTodayKey()
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== today) {
    // New day — we don't need to do anything because we always query by date
    localStorage.setItem(STORAGE_KEY, today)
  }
}

export const rateLimitService = {
  /**
   * Start a usage session. Returns session id to use with endSession().
   */
  startSession(userId: string, modeId: string): number {
    checkAndRotateDay()
    const now = new Date().toISOString()
    run(
      'INSERT INTO usage_logs (user_id, mode_id, started_at) VALUES (?, ?, ?)',
      [userId, modeId, now],
    )
    const result = query('SELECT last_insert_rowid() as id FROM usage_logs') as any[]
    return result[0]?.id ?? 0
  },

  /**
   * End a usage session, recording duration.
   */
  endSession(sessionId: number): void {
    if (!sessionId) return
    const now = new Date().toISOString()
    const started = (query('SELECT started_at FROM usage_logs WHERE id = ?', [sessionId]) as any[])[0]
    if (!started) return
    const durationSec = Math.floor((Date.now() - new Date(started.started_at).getTime()) / 1000)
    run(
      'UPDATE usage_logs SET ended_at = ?, duration_seconds = ? WHERE id = ?',
      [now, durationSec, sessionId],
    )
  },

  /**
   * Get usage stats for a user (today only, local timezone).
   */
  getStats(userId: string, modeId: string, isGuest: boolean): UsageStats {
    checkAndRotateDay()
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const modeRows = query(
      `SELECT COUNT(*) as count FROM usage_logs
       WHERE user_id = ? AND mode_id = ? AND date(started_at) = ?`,
      [userId, modeId, todayStr],
    ) as any[]
    const modeUsageCount = modeRows[0]?.count ?? 0

    const totalRows = query(
      `SELECT COALESCE(SUM(duration_seconds), 0) as total
       FROM usage_logs
       WHERE user_id = ? AND date(started_at) = ?`,
      [userId, todayStr],
    ) as any[]
    const totalSecondsToday = totalRows[0]?.total ?? 0
    const totalMinutesUsed = Math.floor(totalSecondsToday / 60)
    const totalMinutesRemaining = Math.max(0, GUEST_DAILY_MINUTES - totalMinutesUsed)

    return {
      modeUsageCount,
      modeUsageRemaining: isGuest ? Math.max(0, GUEST_MODE_LIMIT - modeUsageCount) : Infinity,
      totalSecondsToday,
      totalMinutesRemaining: isGuest ? totalMinutesRemaining : Infinity,
      isGuest,
    }
  },

  /**
   * Check if user can start a new session in this mode.
   * Registered users always get { allowed: true }.
   */
  checkLimit(userId: string, modeId: string, isGuest: boolean): {
    allowed: boolean
    reason?: 'mode_limit' | 'time_limit'
    stats: UsageStats
  } {
    if (!isGuest) {
      return {
        allowed: true,
        stats: this.getStats(userId, modeId, isGuest),
      }
    }
    const stats = this.getStats(userId, modeId, isGuest)

    if (stats.modeUsageCount >= GUEST_MODE_LIMIT) {
      return { allowed: false, reason: 'mode_limit', stats }
    }
    if (stats.totalMinutesRemaining <= 0) {
      return { allowed: false, reason: 'time_limit', stats }
    }
    return { allowed: true, stats }
  },
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd hsk-vocab-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add hsk-vocab-app/src/services/database.ts hsk-vocab-app/src/services/rate-limit.service.ts
git commit -m "feat(rate-limit): add usage_logs table and rateLimitService for guest limits"
```

---

## Task 2: Create `<RateLimitGuard>` component

**Files:**
- Create: `src/components/RateLimitGuard.tsx`

- [ ] **Step 1: Create the guard component**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores'
import { rateLimitService, GUEST_MODE_LIMIT, GUEST_DAILY_MINUTES } from '@/services/rate-limit.service'
import { Lock, Clock, Sparkles, LogIn, UserPlus } from 'lucide-react'

interface Props {
  modeId: string
  modeName?: string
  children: React.ReactNode
}

export default function RateLimitGuard({ modeId, modeName, children }: Props) {
  const { user, isGuest } = useAuthStore()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [reason, setReason] = useState<'mode_limit' | 'time_limit' | null>(null)
  const [stats, setStats] = useState(rateLimitService.getStats(user?.id || 'guest', modeId, isGuest))
  const sessionIdRef = useRef<number>(0)

  useEffect(() => {
    if (!user?.id) return
    const check = rateLimitService.checkLimit(user.id, modeId, isGuest)
    setAllowed(check.allowed)
    setReason(check.reason ?? null)
    setStats(check.stats)

    if (check.allowed) {
      sessionIdRef.current = rateLimitService.startSession(user.id, modeId)
    }

    return () => {
      if (sessionIdRef.current) {
        rateLimitService.endSession(sessionIdRef.current)
        sessionIdRef.current = 0
      }
    }
  }, [user?.id, modeId, isGuest])

  // Loading state
  if (allowed === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
      </div>
    )
  }

  // Registered users always see the mode
  if (!isGuest) return <>{children}</>

  // Blocked guests
  if (!allowed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full card-glass rounded-3xl p-8 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
          >
            {reason === 'mode_limit' ? <Lock className="w-8 h-8 text-white" /> : <Clock className="w-8 h-8 text-white" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {reason === 'mode_limit' ? 'Daily limit reached' : 'Time limit reached'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            {reason === 'mode_limit'
              ? `You've used ${modeName || 'this mode'} ${GUEST_MODE_LIMIT} times today as a guest.`
              : `You've used ${GUEST_DAILY_MINUTES} minutes of study time today.`}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Sign up free to unlock unlimited {modeName || 'mode'} access and full study time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth?mode=signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
            >
              <Sparkles className="w-4 h-4" /> Sign Up Free
            </Link>
            <Link
              to="/auth?mode=login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
            >
              <LogIn className="w-4 h-4" /> Log In
            </Link>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
            Limits reset at midnight. {Math.floor(stats.totalSecondsToday / 60)} / {GUEST_DAILY_MINUTES} min used today.
          </p>
        </motion.div>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd hsk-vocab-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add hsk-vocab-app/src/components/RateLimitGuard.tsx
git commit -m "feat(rate-limit): add RateLimitGuard component for mode entry"
```

---

## Task 3: Wrap all mode routes in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import RateLimitGuard**

Add to imports at top of `src/App.tsx`:
```typescript
import RateLimitGuard from '@/components/RateLimitGuard'
```

- [ ] **Step 2: Wrap each mode route**

Replace each `<Route path="mode/..." element={...} />` with a wrapping Route:

```tsx
<Route path="/mode/flashcard" element={<Layout />}>
  <Route index element={<RateLimitGuard modeId="flashcard" modeName="Flashcard SRS"><FlashcardMode /></RateLimitGuard>} />
</Route>
```

Apply to all 13 modes:
- flashcard
- listening
- timed-quiz
- sequential-quiz
- visual
- sentence-making
- sentence-puzzle
- translation
- handwriting
- shadowing
- story
- conversation
- smart-review

Example pattern (do this for each):
```tsx
<Route path="/mode/flashcard" element={<Layout />}>
  <Route index element={<RateLimitGuard modeId="flashcard" modeName="Flashcard SRS"><FlashcardMode /></RateLimitGuard>} />
</Route>
```

- [ ] **Step 3: Verify build passes**

Run: `cd hsk-vocab-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add hsk-vocab-app/src/App.tsx
git commit -m "feat(rate-limit): wrap all 13 learning mode routes in RateLimitGuard"
```

---

## Task 4: Add usage indicators to Learn page

**Files:**
- Modify: `src/pages/Learn.tsx`

- [ ] **Step 1: Add usage fetch + display logic**

In `src/pages/Learn.tsx`, inside the `Learn` component, add a `useMemo` that builds mode stats:

```typescript
import { rateLimitService } from '@/services/rate-limit.service'

// inside the component:
const modeStats = useMemo(() => {
  if (!isGuest || !user?.id) return new Map<string, { count: number; remaining: number }>()
  const m = new Map<string, { count: number; remaining: number }>()
  for (const mode of learningModes) {
    const stats = rateLimitService.getStats(user.id, mode.id, isGuest)
    m.set(mode.id, {
      count: stats.modeUsageCount,
      remaining: stats.modeUsageRemaining,
    })
  }
  return m
}, [user?.id, isGuest, words, progress])
```

- [ ] **Step 2: Add `useMemo` to imports**

Change `import { useState, useEffect }` to `import { useState, useEffect, useMemo }`

- [ ] **Step 3: Add `isGuest` to auth store destructure**

Change:
```typescript
const { user } = useAuthStore()
```
to:
```typescript
const { user, isGuest } = useAuthStore()
```

- [ ] **Step 4: Add usage pill to each mode card**

Inside the `.map((mode, index) =>` block, after `<mode.icon ... />` div, add:

```tsx
{isGuest && modeStats.get(mode.id) && (
  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-700/30">
    {modeStats.get(mode.id)!.remaining}/{10} left
  </div>
)}
```

Also add `relative` to the existing `card card-hover` class on the Link:
```tsx
<Link
  to={mode.path}
  className="card card-hover group flex items-start gap-4 block relative"
>
```

- [ ] **Step 5: Add daily time banner**

Above the HSK level filter, add:

```tsx
{isGuest && user?.id && (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="card-glass rounded-2xl p-4 flex items-center gap-3"
  >
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)' }}>
      <Clock className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        Guest mode — {Math.floor(rateLimitService.getStats(user.id, 'all', true).totalSecondsToday / 60)} / 120 min today
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        10 uses per mode · Sign up for unlimited access
      </p>
    </div>
    <Link
      to="/auth?mode=signup"
      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
      style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
    >
      Sign Up
    </Link>
  </motion.div>
)}
```

- [ ] **Step 6: Add Clock to lucide imports**

Add `Clock` to the lucide-react import.

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd hsk-vocab-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add hsk-vocab-app/src/pages/Learn.tsx
git commit -m "feat(rate-limit): show usage indicators on Learn page for guest users"
```

---

## Task 5: Add a usage history section on /me page

**Files:**
- Modify: `src/pages/Me.tsx`

- [ ] **Step 1: Find Me.tsx and add a "Today's Usage" section**

Read `src/pages/Me.tsx` first. Add a new section before the existing logout button that shows:

```tsx
{isGuest && user?.id && (() => {
  const stats = rateLimitService.getStats(user.id, 'all', isGuest)
  const totalUsed = Math.floor(stats.totalSecondsToday / 60)
  return (
    <section className="card-glass rounded-2xl p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Today's Usage</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-300">Total study time</span>
          <span className="font-semibold">{totalUsed} / 120 min</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full"
            style={{
              width: `${Math.min(100, (totalUsed / 120) * 100)}%`,
              background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)',
            }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Sign up free to unlock unlimited access.
        </p>
      </div>
    </section>
  )
})()}
```

- [ ] **Step 2: Add imports to Me.tsx**

Add at top:
```typescript
import { rateLimitService } from '@/services/rate-limit.service'
import { Link } from 'react-router-dom'
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd hsk-vocab-app && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add hsk-vocab-app/src/pages/Me.tsx
git commit -m "feat(rate-limit): show today's usage on Me page for guests"
```

---

## Task 6: Optional Supabase sync (only if env vars are configured)

**Files:**
- Create: `src/services/rate-limit-sync.service.ts`

> This is OPTIONAL — only kicks in if Supabase env vars are set. Local SQLite is the source of truth.

- [ ] **Step 1: Create sync service**

```typescript
import { supabase, isSupabaseConfigured } from './supabase'
import { query } from './database'

/**
 * Mirror usage_logs to Supabase so signed-in users keep their quota
 * across devices. This is a soft sync — local SQLite remains the source of truth.
 */
export const rateLimitSync = {
  async syncSession(userId: string, modeId: string, durationSec: number, startedAt: string): Promise<void> {
    if (!isSupabaseConfigured() || userId.startsWith('guest-')) return
    try {
      await supabase.from('usage_logs').upsert({
        user_id: userId,
        mode_id: modeId,
        duration_seconds: durationSec,
        started_at: startedAt,
      }, { onConflict: 'user_id,mode_id,started_at' })
    } catch (e) {
      console.warn('[usage-sync] failed', e)
    }
  },

  async getRemoteTodayCount(userId: string, modeId: string): Promise<number> {
    if (!isSupabaseConfigured() || userId.startsWith('guest-')) return 0
    try {
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('mode_id', modeId)
        .gte('started_at', `${today}T00:00:00Z`)
      return count ?? 0
    } catch {
      return 0
    }
  },
}
```

- [ ] **Step 2: Add SQL migration for Supabase**

Create `supabase/migrations/20260617_usage_logs.sql`:
```sql
CREATE TABLE IF NOT EXISTS usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  UNIQUE (user_id, mode_id, started_at)
);
CREATE INDEX IF NOT EXISTS idx_usage_user_mode_day ON usage_logs(user_id, mode_id, started_at);
```

- [ ] **Step 3: Commit**

```bash
git add hsk-vocab-app/src/services/rate-limit-sync.service.ts hsk-vocab-app/supabase/migrations/20260617_usage_logs.sql
git commit -m "feat(rate-limit): add optional Supabase sync for usage logs"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Guest 10/day per mode ✅ (Task 1, 2, 3, 4), 2 hours total/day ✅ (Task 1, 4, 5), unlimited for signed-in ✅ (Task 2 conditional), Learn tab indicators ✅ (Task 4), all 13 modes wrapped ✅ (Task 3)
- [x] **No placeholders:** All code is concrete with no TBDs
- [x] **Type consistency:** `rateLimitService`, `GUEST_MODE_LIMIT`, `GUEST_DAILY_MINUTES` used consistently across tasks

## Files Summary

| File | Change |
|------|--------|
| `src/services/database.ts` | +usage_logs table + indexes |
| `src/services/rate-limit.service.ts` | **NEW** — local quota tracking |
| `src/services/rate-limit-sync.service.ts` | **NEW** — optional Supabase sync |
| `src/components/RateLimitGuard.tsx` | **NEW** — wraps each mode route |
| `src/App.tsx` | Wrap 13 mode routes |
| `src/pages/Learn.tsx` | Add daily time banner + per-mode pills |
| `src/pages/Me.tsx` | Add "Today's Usage" section |
| `supabase/migrations/20260617_usage_logs.sql` | **NEW** — optional remote schema |

## Database Schema Decisions

| Table | Where | Purpose |
|-------|-------|---------|
| `usage_logs` | Local SQLite (mandatory) | Source of truth for quota |
| `usage_logs` | Supabase (optional) | Cross-device sync for signed-in users |

**No changes needed to `user_profiles` table** — the user record already has an `id`, and we use that as the `user_id` in `usage_logs`. Both guest (`guest-xxx` IDs) and signed-in users get tracked uniformly in the local table.
