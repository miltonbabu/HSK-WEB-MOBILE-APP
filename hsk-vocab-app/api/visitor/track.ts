// Vercel Serverless Function — Visitor Tracking
// Records a unique visitor by hashed IP. Called fire-and-forget from the client.
// Uses Supabase REST API with service role key to bypass RLS for inserts.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const VISITOR_SALT = process.env.VISITOR_SALT || 'hsk-visitor-salt-v1'

const RAW_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
const ALLOWED_ORIGINS = RAW_ORIGINS.filter(o => o !== '*')

// Per-IP rate limit: 10 req/min (tracking only needs once per session)
const RATE_LIMIT = 10
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
  const v = (req.headers['x-vercel-ip'] as string) || req.socket?.remoteAddress || '0.0.0.0'
  return String(v)
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + VISITOR_SALT).digest('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ──
  const origin = (req.headers.origin as string) || ''
  if (ALLOWED_ORIGINS.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', 'null')
    res.setHeader('Vary', 'Origin')
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  } else {
    if (req.method === 'OPTIONS') return res.status(204).end()
    return res.status(403).json({ error: 'Origin not allowed' })
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limit
  const ip = clientIp(req)
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  // If Supabase is not configured, silently succeed (tracking is non-critical)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(200).json({ ok: true })
  }

  try {
    const { isGuest = true } = req.body || {}
    const ipHash = hashIp(ip)
    const userAgent = (req.headers['user-agent'] as string) || ''
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Insert with ON CONFLICT DO NOTHING — deduplicates by (ip_hash, visit_date)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/visitor_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({
        ip_hash: ipHash,
        visit_date: today,
        first_visit_at: now,
        user_agent: userAgent.slice(0, 500),
        is_guest: !!isGuest,
      }),
    })

    if (!response.ok && response.status !== 409) {
      console.error('[Visitor Track] Supabase error:', response.status)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[Visitor Track] Error:', err)
    return res.status(200).json({ ok: true }) // silent fail
  }
}
