// Vercel Serverless Function — AI Chat Proxy
// Same logic as backend/server.js but deployed as a Vercel Function.
// DeepSeek API key is stored in Vercel Environment Variables (server-side only).
//
// Called by both web app (relative path /api/ai/chat)
// and mobile app (full URL https://your-app.vercel.app/api/ai/chat).

import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const RAW_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = RAW_ORIGINS.filter((o) => o !== '*');

// ── Per-IP in-process rate limit ──
// 30 requests / minute / IP. In-memory only (resets on cold start, which
// is fine — Vercel kills the function instance regularly anyway).
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const ipHits = new Map<string, { count: number; resetAt: number }>();
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
  // Trust the Vercel-provided IP and the connection socket. We deliberately
  // do NOT trust x-forwarded-for from the client because the Vercel edge
  // will let a client overwrite it on unauthenticated requests, which
  // would let any caller bypass per-IP rate limits.
  const v = (req.headers['x-vercel-ip'] as string) || req.socket?.remoteAddress || '0.0.0.0'
  return String(v)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ──
  const origin = (req.headers.origin as string) || ''
  // Reject all cross-origin calls when no allow-list is configured, rather
  // than silently defaulting to "*" (the old behavior leaked the proxy to
  // every site on the internet).
  if (ALLOWED_ORIGINS.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', 'null')
    res.setHeader('Vary', 'Origin')
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  } else {
    // Unknown origin — return 403 instead of CORS-allowing it.
    if (req.method === 'OPTIONS') return res.status(204).end()
    return res.status(403).json({ error: 'Origin not allowed' })
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Rate limit ──
  const ip = clientIp(req)
  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter))
    return res.status(429).json({ error: 'Too many requests' })
  }

  try {
    const { messages, model, temperature, max_tokens, stream } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (!DEEPSEEK_API_KEY) {
      console.error('[AI Proxy] DEEPSEEK_API_KEY not configured');
      return res.status(500).json({
        error: 'AI service not configured. Set DEEPSEEK_API_KEY in Vercel Environment Variables.',
      });
    }

    const useStream = stream === true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages,
        stream: useStream,
        temperature: temperature ?? 0.5,
        max_tokens: max_tokens ?? 512,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[AI Proxy] DeepSeek error ${response.status}:`, errText.slice(0, 200));
      return res.status(response.status).json({
        error: `DeepSeek API returned ${response.status}`,
      });
    }

    if (useStream && response.body) {
      // Stream SSE response from DeepSeek back to client
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    console.error('[AI Proxy] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}