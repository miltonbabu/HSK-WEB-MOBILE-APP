// Vercel Serverless Function — Math Captcha Challenge Generator
// Returns a math problem and an encrypted token containing the answer.
// The token is verified server-side in api/ai/chat.ts before AI calls.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const CAPTCHA_SECRET = (process.env.CAPTCHA_SECRET || 'hsk-captcha-secret-v1').padEnd(32).slice(0, 32)
const RAW_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
const ALLOWED_ORIGINS = RAW_ORIGINS.filter(o => o !== '*')

// Per-IP rate limit: 30 req/min
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
  const v = (req.headers['x-vercel-ip'] as string) || req.socket?.remoteAddress || '0.0.0.0'
  return String(v)
}

function encrypt(payload: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(CAPTCHA_SECRET, 'utf8'), iv)
  let encrypted = cipher.update(payload, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function generateProblem(): { problem: string; answer: number } {
  const ops = ['+', '-']
  const op = ops[Math.floor(Math.random() * ops.length)]

  let a: number, b: number, answer: number

  if (op === '+') {
    a = Math.floor(Math.random() * 9) + 1
    b = Math.floor(Math.random() * 9) + 1
    answer = a + b
  } else {
    a = Math.floor(Math.random() * 9) + 1
    b = Math.floor(Math.random() * 9) + 1
    if (a < b) [a, b] = [b, a]
    answer = a - b
  }

  return { problem: `${a} ${op} ${b}`, answer }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ── (captcha is a public endpoint, allow all origins)
  const origin = (req.headers.origin as string) || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ip = clientIp(req)
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const { problem, answer } = generateProblem()
  const expiresAt = Date.now() + 600_000 // 10 minutes
  const token = encrypt(JSON.stringify({ answer, expiresAt }))

  return res.status(200).json({ problem, token })
}
