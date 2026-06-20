// Vercel Serverless Function — AI Chat Proxy
// Same logic as backend/server.js but deployed as a Vercel Function.
// DeepSeek API key is stored in Vercel Environment Variables (server-side only).
//
// Called by both web app (relative path /api/ai/chat)
// and mobile app (full URL https://your-app.vercel.app/api/ai/chat).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { checkRateLimit } from '../lib/rate-limit';
import { getCircuitState, recordSuccess, recordFailure } from '../lib/circuit-breaker';
import { deriveCacheKey, getCachedResponse, setCachedResponse, shouldBypassCache } from '../lib/ai-cache';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const CAPTCHA_SECRET = (process.env.CAPTCHA_SECRET || 'hsk-captcha-secret-v1').padEnd(32).slice(0, 32);

// ── Captcha token decryption ──
function decryptToken(token: string): { answer: number; expiresAt: number } | null {
  try {
    const [ivHex, encrypted] = token.split(':');
    if (!ivHex || !encrypted) return null;
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(CAPTCHA_SECRET, 'utf8'), Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

function verifyCaptcha(token: string, answer: unknown): boolean {
  const data = decryptToken(token);
  if (!data) return false;
  if (Date.now() >= data.expiresAt) return false;
  const userAnswer = parseInt(String(answer), 10);
  if (isNaN(userAnswer)) return false;
  return userAnswer === data.answer;
}

// ── Per-IP rate limit is now backed by Upstash Redis (see api/lib/rate-limit.ts).
// Falls back to in-memory when Redis is unconfigured. Authenticated users get
// a higher per-token limit (120/min) vs anonymous IP (30/min).

function clientIp(req: VercelRequest): string {
  // Trust the Vercel-provided IP and the connection socket. We deliberately
  // do NOT trust x-forwarded-for from the client because the Vercel edge
  // will let a client overwrite it on unauthenticated requests, which
  // would let any caller bypass per-IP rate limits.
  const v = (req.headers['x-vercel-ip'] as string) || req.socket?.remoteAddress || '0.0.0.0'
  return String(v)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ── (AI chat is used by both guests and registered users, allow all origins)
  const origin = (req.headers.origin as string) || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Rate limit (Redis-backed, falls back to in-memory) ──
  const ip = clientIp(req)
  const authHeader = (req.headers['authorization'] as string) || ''
  const rl = await checkRateLimit(ip, authHeader)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter))
    return res.status(429).json({ error: 'Too many requests' })
  }

  // ── Captcha verification for guests ──
  // Registered users send a Bearer token in Authorization header — skip captcha.
  // Guests must provide a valid captchaToken + captchaAnswer for chat requests.
  // Learning mode requests (source !== 'chat') are allowed without captcha
  // because they're already rate-limited by RateLimitGuard (10 uses/mode/day).
  const hasUserToken = authHeader.startsWith('Bearer ') && authHeader.length > 20

  if (!hasUserToken) {
    const { captchaToken, captchaAnswer, source } = req.body || {}
    if (source === 'chat') {
      if (!captchaToken || captchaAnswer === undefined) {
        return res.status(403).json({ error: 'Captcha required', code: 'CAPTCHA_REQUIRED' })
      }
      if (!verifyCaptcha(captchaToken, captchaAnswer)) {
        return res.status(403).json({ error: 'Captcha verification failed', code: 'CAPTCHA_INVALID' })
      }
    }
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
    const effectiveModel = model || 'deepseek-chat';
    const effectiveTemp = temperature ?? 0.5;
    const effectiveMaxTokens = max_tokens ?? 512;

    // ── Cache lookup (skip for time-sensitive prompts) ──
    const bypassCache = shouldBypassCache(messages);
    const cacheKey = bypassCache
      ? null
      : deriveCacheKey({
          model: effectiveModel,
          temperature: effectiveTemp,
          max_tokens: effectiveMaxTokens,
          messages,
        });

    if (cacheKey) {
      const cached = await getCachedResponse(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { stream: boolean; body: string };
          res.setHeader('X-Cache', 'HIT');
          if (parsed.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            return res.end(parsed.body);
          }
          res.setHeader('Content-Type', 'application/json');
          return res.end(parsed.body);
        } catch {
          // Malformed cache entry — fall through to DeepSeek.
        }
      }
    }

    // ── Circuit breaker: fail-fast when DeepSeek is known-down ──
    const circuit = await getCircuitState();
    if (!circuit.allow) {
      res.setHeader('Retry-After', '30');
      return res.status(503).json({
        error: 'AI service temporarily unavailable',
        fallback: 'local',
        reason: 'circuit_open',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages,
        stream: useStream,
        temperature: effectiveTemp,
        max_tokens: effectiveMaxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[AI Proxy] DeepSeek error ${response.status}:`, errText.slice(0, 200));
      await recordFailure();
      return res.status(response.status).json({
        error: `DeepSeek API returned ${response.status}`,
      });
    }

    // Success — record it so the circuit breaker can close.
    await recordSuccess();
    res.setHeader('X-Cache', 'MISS');

    if (useStream && response.body) {
      // Stream SSE response from DeepSeek back to client, and assemble the
      // raw text so we can cache it for future identical requests.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assembled = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          assembled += chunk;
          res.write(chunk);
        }
      } finally {
        reader.releaseLock();
        res.end();
      }

      // Cache the assembled SSE stream for replay on future hits.
      if (cacheKey && assembled) {
        await setCachedResponse(cacheKey, JSON.stringify({ stream: true, body: assembled }));
      }
    } else {
      const data = await response.json();
      const bodyStr = JSON.stringify(data);
      res.setHeader('Content-Type', 'application/json');
      res.end(bodyStr);

      if (cacheKey) {
        await setCachedResponse(cacheKey, JSON.stringify({ stream: false, body: bodyStr }));
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      await recordFailure();
      return res.status(504).json({ error: 'Request timed out' });
    }
    console.error('[AI Proxy] Unexpected error:', err);
    await recordFailure();
    res.status(500).json({ error: 'Internal server error' });
  }
}