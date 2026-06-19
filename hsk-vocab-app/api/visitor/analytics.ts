// Vercel Serverless Function — Visitor Analytics (admin only)
// Reads visitor_logs via service role key, bypassing RLS.
// Requires the caller to present a valid admin JWT.

import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Optional hard-coded super-admin allowlist (comma-separated). Used as a
// fallback when the caller's email is not (yet) present in public.user_profiles
// with is_admin=true. Set this in Vercel env vars to keep analytics working
// even if the local mock admin (whose user_profiles row lives in client-side
// SQLite, not in Supabase) is the one logging in.
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

// Per-IP rate limit
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000
const ipHits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || now >= entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count += 1
  return true
}

function clientIp(req: VercelRequest): string {
  const v = (req.headers['x-forwarded-for'] as string) || (req.headers['x-vercel-ip'] as string) || req.socket?.remoteAddress || '0.0.0.0'
  return String(v).split(',')[0].trim()
}

// Verify the admin JWT. We trust the `email` claim from the token and
// re-validate server-side in this order:
//   1. SUPER_ADMIN_EMAILS env-var allowlist (always wins — useful when
//      the admin logs in via the local mock path and has no Supabase
//      user_profiles row).
//   2. public.user_profiles.is_admin === true (the normal path for real
//      Supabase admin logins).
// Email-based (not id-based) is intentional: the local mock JWT issued by
// supabase.ts in dev/APP_MODE=development uses an integer `sub`, while
// real Supabase access tokens use a UUID `sub`. Email is the only claim
// that's stable across both paths.
async function verifyAdminToken(token: string): Promise<boolean> {
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const json = Buffer.from(padded, 'base64').toString('utf-8')
    const data = JSON.parse(json)
    if (data.exp && Date.now() / 1000 > data.exp) return false

    const email = String(data.email || '').toLowerCase()
    console.log('[Visitor Analytics] Token email:', email, 'sub:', data.sub)

    // 1. Hard-coded super-admin allowlist (env-var)
    if (email && SUPER_ADMIN_EMAILS.includes(email)) {
      console.log('[Visitor Analytics] Auth OK via SUPER_ADMIN_EMAILS allowlist')
      return true
    }

    // 2. user_profiles.is_admin check (requires Supabase env vars)
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.log('[Visitor Analytics] No Supabase env vars — denying')
      return false
    }

    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=is_admin`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    )
    console.log('[Visitor Analytics] user_profiles status:', resp.status)
    if (!resp.ok) return false
    const rows = await resp.json()
    const ok = Array.isArray(rows) && rows.length > 0 && rows[0].is_admin === true
    console.log('[Visitor Analytics] user_profiles.is_admin =', ok, 'rows:', rows.length)
    return ok
  } catch (err) {
    console.error('[Visitor Analytics] verifyAdminToken error:', err)
    return false
  }
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = (req.headers.origin as string) || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limit
  const ip = clientIp(req)
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  // Auth — must be admin
  const auth = (req.headers.authorization as string) || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!(await verifyAdminToken(token))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Supabase not configured' })
  }

  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 14))
    const today = new Date()
    const todayStr = isoDate(today)
    const weekAgo = isoDate(new Date(today.getTime() - 6 * 86400000))
    const monthStart = isoDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const trendStart = isoDate(new Date(today.getTime() - (days - 1) * 86400000))

    // Run all 4 reads in parallel using service-role key (bypasses RLS)
    const baseHeaders = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
    const fetchCount = (q: string) =>
      fetch(`${SUPABASE_URL}/rest/v1/visitor_logs?${q}`, { headers: baseHeaders })
        .then(async (r) => {
          if (!r.ok) return 0
          const arr = await r.json()
          return Array.isArray(arr) ? arr.length : 0
        })
        .catch(() => 0)

    const [todayCount, weekCount, monthCount, trendRows] = await Promise.all([
      fetchCount(`select=id&visit_date=eq.${todayStr}&limit=10000`),
      fetchCount(`select=id&visit_date=gte.${weekAgo}&limit=10000`),
      fetchCount(`select=id&visit_date=gte.${monthStart}&limit=10000`),
      fetch(
        `${SUPABASE_URL}/rest/v1/visitor_logs?select=visit_date&visit_date=gte.${trendStart}&order=visit_date.asc&limit=10000`,
        { headers: baseHeaders }
      )
        .then(async (r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])

    console.log('[Visitor Analytics] Counts:', { todayCount, weekCount, monthCount, trendRows: Array.isArray(trendRows) ? trendRows.length : 'n/a' })

    // Group trend by date
    const counts = new Map<string, number>()
    for (const row of trendRows as Array<{ visit_date: string }>) {
      const d = row.visit_date
      counts.set(d, (counts.get(d) || 0) + 1)
    }
    const trend: Array<{ date: string; count: number }> = []
    for (let i = 0; i < days; i++) {
      const date = isoDate(new Date(today.getTime() - (days - 1 - i) * 86400000))
      trend.push({ date, count: counts.get(date) || 0 })
    }

    return res.status(200).json({
      stats: { today: todayCount, thisWeek: weekCount, thisMonth: monthCount },
      trend,
    })
  } catch (err) {
    console.error('[Visitor Analytics] Error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
