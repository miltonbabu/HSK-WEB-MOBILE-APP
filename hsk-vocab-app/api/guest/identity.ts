// Vercel Serverless Function — Guest Identity
// Returns the visitor's IP address so the client can use it
// as a consistent guest ID across tabs/browsers for rate limiting.

import type { VercelRequest, VercelResponse } from '@vercel/node'

// In-process rate limit: 60 req / minute / IP. IP is taken from Vercel's
// trusted header or the socket, NEVER from a client-supplied x-forwarded-for
// (the Vercel edge will accept that header from clients by default, which
// would let any caller spoof their ID and reset their rate-limit bucket).
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000
const ipHits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || now >= entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return { allowed: true, retryAfter: 0 }
  }
  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count += 1
  return { allowed: true, retryAfter: 0 }
}

function clientIp(req: VercelRequest): string {
  const v = (req.headers['x-vercel-ip'] as string) || req.socket?.remoteAddress || '0.0.0.0'
  return String(v)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ── (guest identity is a public endpoint, allow all origins)
  const origin = (req.headers.origin as string) || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Rate limit ──
  const ip = clientIp(req)
  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter))
    return res.status(429).json({ error: 'Too many requests' })
  }

  // Use the Vercel-trusted IP only. Never read x-forwarded-for from the
  // request — the edge honors whatever the client sends.
  return res.status(200).json({ ip, fingerprint: ip })
}