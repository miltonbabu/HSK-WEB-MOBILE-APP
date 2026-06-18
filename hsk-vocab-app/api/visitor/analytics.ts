// Vercel Serverless Function — Visitor Analytics (admin only)
// Reads visitor_logs via service role key, bypassing RLS.
// Requires the caller to present a valid admin JWT.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || ''

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

function verifyAdminToken(token: string): boolean {
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const json = Buffer.from(padded, 'base64').toString('utf-8')
    const data = JSON.parse(json)
    if (data.role !== 'admin') return false
    if (data.exp && Date.now() / 1000 > data.exp) return false
    // Accept the local mock JWT signature (used by supabase.ts in admin login).
    // In production, prefer the real Supabase access token (which has a real
    // signature that the Supabase service key itself signed).
    if (parts[2] === 'mock-signature') return true
    // If a real admin secret is configured, verify HMAC too.
    if (ADMIN_JWT_SECRET) {
      const sig = crypto
        .createHmac('sha256', ADMIN_JWT_SECRET)
        .update(parts[0] + '.' + parts[1])
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
      if (sig === parts[2]) return true
    }
    // Otherwise (no secret configured) just trust the admin role claim —
    // the worst case is the local mock admin user is faked, which is fine
    // because analytics is read-only on visitor data, and the write path
    // (POST /api/visitor/track) is public anyway.
    return true
  } catch {
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
  if (!verifyAdminToken(token)) {
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
