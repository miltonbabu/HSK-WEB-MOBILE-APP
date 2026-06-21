// Vercel Serverless Function — AI Chat Proxy with Redis caching,
// rate limiting, and circuit breaker. All shared logic is inlined because
// Vercel's bundler had trouble importing from api/lib/ subdirectories.
//
// DeepSeek API key is stored in Vercel Environment Variables (server-side only).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createDecipheriv } from 'crypto';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const CAPTCHA_SECRET = (process.env.CAPTCHA_SECRET || 'hsk-captcha-secret-v1').padEnd(32).slice(0, 32);

// ─────────────────────────────────────────────────────────────────────────────
// Upstash Redis client (direct REST API — zero dependencies)
// ─────────────────────────────────────────────────────────────────────────────

function isRedisConfigured(): boolean {
  return UPSTASH_URL.length > 0 && UPSTASH_TOKEN.length > 0;
}

async function upstashExec(args: unknown[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('redis not configured');
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upstash ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as { result?: unknown; error?: string };
  if (data.error) throw new Error(`upstash: ${data.error}`);
  return data.result;
}

async function redisGet(key: string): Promise<string | null> {
  const result = await upstashExec(['GET', key]);
  return result === null ? null : String(result);
}

async function redisSet(key: string, value: string, ex?: number): Promise<void> {
  const args: unknown[] = ['SET', key, value];
  if (ex) args.push('EX', ex);
  await upstashExec(args);
}

async function redisIncr(key: string): Promise<number> {
  return Number(await upstashExec(['INCR', key]));
}

async function redisExpire(key: string, seconds: number): Promise<void> {
  await upstashExec(['EXPIRE', key, seconds]);
}

async function redisTtl(key: string): Promise<number> {
  return Number(await upstashExec(['TTL', key]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────

const ANON_LIMIT = 30;
const AUTH_LIMIT = 120;
const WINDOW_SECONDS = 60;

const memHits = new Map<string, { count: number; resetAt: number }>();

function memCheck(key: string, limit: number): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const entry = memHits.get(key);
  if (!entry || now >= entry.resetAt) {
    memHits.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    return { allowed: true, resetAt: now + WINDOW_SECONDS * 1000 };
  }
  if (entry.count >= limit) {
    return { allowed: false, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, resetAt: entry.resetAt };
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

async function checkRateLimit(ip: string, authHeader: string): Promise<RateLimitResult> {
  const hasUserToken = authHeader.startsWith('Bearer ') && authHeader.length > 20;
  const bucketKey = hasUserToken
    ? `user:${createHash('sha256').update(authHeader).digest('hex').slice(0, 16)}`
    : `ip:${ip}`;
  const limit = hasUserToken ? AUTH_LIMIT : ANON_LIMIT;

  try {
    if (!isRedisConfigured()) throw new Error('redis not configured');
    const redisKey = `rate:${bucketKey}`;
    const count = await redisIncr(redisKey);
    if (count === 1) await redisExpire(redisKey, WINDOW_SECONDS);
    const ttl = await redisTtl(redisKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl : WINDOW_SECONDS) * 1000;
    return {
      allowed: count <= limit,
      retryAfter: count <= limit ? 0 : Math.ceil((resetAt - Date.now()) / 1000),
    };
  } catch {
    const r = memCheck(bucketKey, limit);
    return {
      allowed: r.allowed,
      retryAfter: r.allowed ? 0 : Math.ceil((r.resetAt - Date.now()) / 1000),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Circuit breaker
// ─────────────────────────────────────────────────────────────────────────────

const CB_KEY = 'cb:deepseek';
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30_000;

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  openedAt: number;
}

let memState: CircuitRecord = { state: 'closed', failures: 0, openedAt: 0 };

function readMem(): CircuitRecord {
  const now = Date.now();
  if (memState.state === 'open' && now - memState.openedAt > COOLDOWN_MS) {
    memState = { ...memState, state: 'half-open' };
  }
  return memState;
}

async function readRedisCircuit(): Promise<CircuitRecord> {
  const raw = await redisGet(CB_KEY);
  if (!raw) return { state: 'closed', failures: 0, openedAt: 0 };
  const rec = JSON.parse(raw) as CircuitRecord;
  if (rec.state === 'open' && Date.now() - rec.openedAt > COOLDOWN_MS) {
    rec.state = 'half-open';
  }
  return rec;
}

async function writeRedisCircuit(rec: CircuitRecord): Promise<void> {
  await redisSet(CB_KEY, JSON.stringify(rec), 3600);
}

interface CircuitDecision {
  allow: boolean;
  state: CircuitState;
}

async function getCircuitState(): Promise<CircuitDecision> {
  try {
    if (!isRedisConfigured()) throw new Error('redis not configured');
    const rec = await readRedisCircuit();
    return { allow: rec.state !== 'open', state: rec.state };
  } catch {
    const rec = readMem();
    return { allow: rec.state !== 'open', state: rec.state };
  }
}

async function recordSuccess(): Promise<void> {
  try {
    if (isRedisConfigured()) await writeRedisCircuit({ state: 'closed', failures: 0, openedAt: 0 });
  } catch { /* ignore */ }
  memState = { state: 'closed', failures: 0, openedAt: 0 };
}

async function recordFailure(): Promise<void> {
  let current: CircuitRecord;
  try {
    if (isRedisConfigured()) current = await readRedisCircuit();
    else throw new Error('redis not configured');
  } catch {
    current = readMem();
  }

  let next: CircuitRecord;
  if (current.state === 'half-open') {
    next = { state: 'open', failures: current.failures + 1, openedAt: Date.now() };
  } else {
    const failures = current.failures + 1;
    next = failures >= FAILURE_THRESHOLD
      ? { state: 'open', failures, openedAt: Date.now() }
      : { state: 'closed', failures, openedAt: 0 };
  }

  try {
    if (isRedisConfigured()) await writeRedisCircuit(next);
  } catch { /* ignore */ }
  memState = next;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI response cache
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 86_400; // 24h
const CACHE_PREFIX = 'cache:ai:';

function deriveCacheKey(params: {
  model: string;
  temperature: number;
  max_tokens: number;
  messages: unknown[];
}): string {
  const normalized = {
    model: params.model,
    temperature: params.temperature,
    max_tokens: params.max_tokens,
    messages: params.messages,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function shouldBypassCache(messages: unknown[]): boolean {
  const last = messages[messages.length - 1];
  if (typeof last !== 'object' || last === null) return false;
  const content = (last as { content?: unknown }).content;
  if (typeof content !== 'string') return false;
  const today = new Date().toISOString().slice(0, 10);
  if (content.includes(today)) return true;
  return /\b(current|today|now|time)\b/i.test(content);
}

async function getCachedResponse(cacheKey: string): Promise<string | null> {
  if (!isRedisConfigured()) return null;
  try {
    return await redisGet(CACHE_PREFIX + cacheKey);
  } catch (err) {
    console.warn('[ai-cache] get failed:', err);
    return null;
  }
}

async function setCachedResponse(cacheKey: string, response: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await redisSet(CACHE_PREFIX + cacheKey, response, CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn('[ai-cache] set failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Captcha token decryption
// ─────────────────────────────────────────────────────────────────────────────

function decryptToken(token: string): { answer: number; expiresAt: number } | null {
  try {
    const [ivHex, encrypted] = token.split(':');
    if (!ivHex || !encrypted) return null;
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(CAPTCHA_SECRET, 'utf8'), Buffer.from(ivHex, 'hex'));
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

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

function clientIp(req: VercelRequest): string {
  const v = (req.headers['x-vercel-ip'] as string) || req.socket?.remoteAddress || '0.0.0.0';
  return String(v);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Rate limit ──
  const ip = clientIp(req);
  const authHeader = (req.headers['authorization'] as string) || '';
  const rl = await checkRateLimit(ip, authHeader);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests' });
  }

  // ── Captcha verification for guests ──
  const hasUserToken = authHeader.startsWith('Bearer ') && authHeader.length > 20;

  if (!hasUserToken) {
    const { captchaToken, captchaAnswer, source } = req.body || {};
    if (source === 'chat') {
      if (!captchaToken || captchaAnswer === undefined) {
        return res.status(403).json({ error: 'Captcha required', code: 'CAPTCHA_REQUIRED' });
      }
      if (!verifyCaptcha(captchaToken, captchaAnswer)) {
        return res.status(403).json({ error: 'Captcha verification failed', code: 'CAPTCHA_INVALID' });
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

    // ── Cache lookup ──
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

    // ── Circuit breaker ──
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

    await recordSuccess();
    res.setHeader('X-Cache', 'MISS');

    if (useStream && response.body) {
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
