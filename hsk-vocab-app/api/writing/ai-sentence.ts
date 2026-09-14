// Vercel Serverless Function — AI sentence generation for Chinese Writing
// Practice. Mirrors the conventions of api/ai/chat.ts: the DeepSeek key stays
// server-side, results are cached in Redis, per-user/IP daily rate limits are
// enforced, and every response is validated before it reaches the client.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const ANON_LIMIT = Number(process.env.WRITING_AI_ANON_LIMIT || 20);
const AUTH_LIMIT = Number(process.env.WRITING_AI_AUTH_LIMIT || 100);
const WINDOW_SECONDS = 86_400;
const CACHE_TTL_SECONDS = 2_592_000; // 30 days
const CACHE_PREFIX = 'cache:writing:sentence:v1:';

const VALID_LEVELS = new Set([1, 2, 3, 4]);
const VALID_DIFFICULTIES = new Set(['short', 'medium', 'long']);

// ── Redis (raw REST, zero deps) ─────────────────────────────────────────────

function isRedisConfigured(): boolean {
  return UPSTASH_URL.length > 0 && UPSTASH_TOKEN.length > 0;
}

async function upstashExec(args: unknown[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`upstash: ${data.error}`);
  return data.result;
}

async function redisGet(key: string): Promise<string | null> {
  const result = await upstashExec(['GET', key]);
  return result === null ? null : String(result);
}

async function redisSet(key: string, value: string, ex: number): Promise<void> {
  await upstashExec(['SET', key, value, 'EX', ex]);
}

// ── Rate limiting (per day) ─────────────────────────────────────────────────

const memHits = new Map<string, { count: number; resetAt: number }>();

function memCheck(key: string, limit: number): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const entry = memHits.get(key);
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + WINDOW_SECONDS * 1000;
    memHits.set(key, { count: 1, resetAt });
    return { allowed: true, resetAt };
  }
  if (entry.count >= limit) return { allowed: false, resetAt: entry.resetAt };
  entry.count += 1;
  return { allowed: true, resetAt: entry.resetAt };
}

async function checkRateLimit(ip: string, authHeader: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const hasUserToken = authHeader.startsWith('Bearer ') && authHeader.length > 20;
  const bucket = hasUserToken
    ? `user:${createHash('sha256').update(authHeader).digest('hex').slice(0, 16)}`
    : `ip:${ip}`;
  const limit = hasUserToken ? AUTH_LIMIT : ANON_LIMIT;

  try {
    if (!isRedisConfigured()) throw new Error('redis not configured');
    const key = `rate:writing:${bucket}`;
    const count = Number(await upstashExec(['INCR', key]));
    if (count === 1) await upstashExec(['EXPIRE', key, WINDOW_SECONDS]);
    if (count <= limit) return { allowed: true, retryAfter: 0 };
    const ttl = Number(await upstashExec(['TTL', key]));
    return { allowed: false, retryAfter: ttl > 0 ? ttl : WINDOW_SECONDS };
  } catch {
    const r = memCheck(bucket, limit);
    return { allowed: r.allowed, retryAfter: r.allowed ? 0 : Math.ceil((r.resetAt - Date.now()) / 1000) };
  }
}

// ── Circuit breaker (protects DeepSeek) ─────────────────────────────────────

const CB_KEY = 'cb:deepseek:writing';
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30_000;

let memFailures = 0;
let memOpenedAt = 0;

async function circuitAllows(): Promise<boolean> {
  try {
    if (!isRedisConfigured()) throw new Error('no redis');
    const raw = await redisGet(CB_KEY);
    if (!raw) return true;
    const rec = JSON.parse(raw) as { failures: number; openedAt: number };
    if (rec.failures >= FAILURE_THRESHOLD && Date.now() - rec.openedAt < COOLDOWN_MS) return false;
    return true;
  } catch {
    if (memFailures >= FAILURE_THRESHOLD && Date.now() - memOpenedAt < COOLDOWN_MS) return false;
    return true;
  }
}

async function recordSuccess(): Promise<void> {
  memFailures = 0;
  memOpenedAt = 0;
  try {
    if (isRedisConfigured()) await redisSet(CB_KEY, JSON.stringify({ failures: 0, openedAt: 0 }), 3600);
  } catch {
    /* ignore */
  }
}

async function recordFailure(): Promise<void> {
  memFailures += 1;
  if (memFailures >= FAILURE_THRESHOLD) memOpenedAt = Date.now();
  try {
    if (!isRedisConfigured()) return;
    const raw = await redisGet(CB_KEY);
    const rec = raw ? (JSON.parse(raw) as { failures: number; openedAt: number }) : { failures: 0, openedAt: 0 };
    const next = {
      failures: rec.failures + 1,
      openedAt: rec.failures + 1 >= FAILURE_THRESHOLD ? Date.now() : 0,
    };
    await redisSet(CB_KEY, JSON.stringify(next), 3600);
  } catch {
    /* ignore */
  }
}

// ── HSK scope validation (characters allowed at the requested level) ────────

const allowedCharsCache = new Map<number, { chars: Set<string>; expiresAt: number }>();
const SCOPE_TTL_MS = 86_400_000;

async function getAllowedChars(level: number): Promise<Set<string> | null> {
  const cached = allowedCharsCache.get(level);
  if (cached && cached.expiresAt > Date.now()) return cached.chars;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  try {
    const url = `${SUPABASE_URL}/rest/v1/words?select=chinese&hsk_level=lte.${level}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ chinese?: string }>;
    const chars = new Set<string>();
    for (const row of rows) {
      for (const ch of row.chinese || '') chars.add(ch);
    }
    allowedCharsCache.set(level, { chars, expiresAt: Date.now() + SCOPE_TTL_MS });
    return chars;
  } catch {
    return null;
  }
}

// ── Generation ──────────────────────────────────────────────────────────────

const LEVEL_LENGTH: Record<number, [number, number]> = {
  1: [4, 8],
  2: [5, 12],
  3: [8, 18],
  4: [10, 25],
};

function lengthRange(level: number, difficulty: string): [number, number] {
  const base = LEVEL_LENGTH[level] || LEVEL_LENGTH[2];
  if (difficulty === 'short') return [Math.max(3, base[0] - 1), base[0] + 3];
  if (difficulty === 'long') return [base[1], base[1] + 12];
  return base;
}

function countChinese(value: string): number {
  const m = value.match(/[\u4e00-\u9fff]/g);
  return m ? m.length : 0;
}

interface GeneratedSentence {
  sentence: string;
  pinyin: string;
  translation: string;
  target_words: string[];
  hsk_level: number;
}

async function generateOnce(params: {
  level: number;
  difficulty: string;
  targetWord: string | null;
}): Promise<GeneratedSentence | null> {
  const { level, difficulty, targetWord } = params;
  const [minLen, maxLen] = lengthRange(level, difficulty);

  const system =
    'You generate Chinese writing exercises for HSK learners. ' +
    'Respond with a single JSON object only — no markdown, no commentary.';

  const user = [
    `Create ONE natural Mandarin sentence for an HSK ${level} learner.`,
    `Difficulty: ${difficulty} (about ${minLen}-${maxLen} Chinese characters).`,
    `Use ONLY HSK ${level} vocabulary and simpler levels (HSK 1-${level}). Avoid advanced words.`,
    targetWord ? `The target word "${targetWord}" MUST appear naturally in the sentence.` : '',
    'The sentence must be natural, everyday Mandarin — not stiff textbook phrasing.',
    'Return JSON with exactly these keys:',
    '{"sentence": "<Chinese sentence with punctuation>", "pinyin": "<pinyin with tone marks>", "translation": "<English translation>", "target_words": ["<the target word(s) used>"], "hsk_level": ' + level + '}',
  ]
    .filter(Boolean)
    .join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
        temperature: 0.8,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    await recordFailure();
    return null;
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || '';
  return parseAndValidate(content, { level, difficulty, targetWord, minLen, maxLen });
}

function parseAndValidate(
  content: string,
  ctx: { level: number; difficulty: string; targetWord: string | null; minLen: number; maxLen: number },
): GeneratedSentence | null {
  let parsed: any;
  try {
    const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return null;
  }

  const sentence = typeof parsed?.sentence === 'string' ? parsed.sentence.trim() : '';
  const pinyin = typeof parsed?.pinyin === 'string' ? parsed.pinyin.trim() : '';
  const translation = typeof parsed?.translation === 'string' ? parsed.translation.trim() : '';
  const targetWords = Array.isArray(parsed?.target_words)
    ? parsed.target_words.filter((w: unknown): w is string => typeof w === 'string')
    : [];

  if (!sentence || !pinyin || !translation) return null;
  if (!/[\u4e00-\u9fff]/.test(sentence)) return null;

  const length = countChinese(sentence);
  if (length < Math.max(3, ctx.minLen - 1) || length > ctx.maxLen + 5) return null;

  if (ctx.targetWord && !sentence.includes(ctx.targetWord)) return null;

  return { sentence, pinyin, translation, target_words: targetWords, hsk_level: ctx.level };
}

async function validateScope(sentence: string, level: number): Promise<boolean> {
  const allowed = await getAllowedChars(level);
  if (!allowed || allowed.size === 0) return true; // can't verify → don't block

  let unknown = 0;
  let total = 0;
  for (const ch of sentence) {
    if (!/[\u4e00-\u9fff]/.test(ch)) continue;
    total += 1;
    if (!allowed.has(ch)) unknown += 1;
  }
  if (total === 0) return false;
  return unknown / total <= 0.25;
}

// ── Body parsing ────────────────────────────────────────────────────────────

function readBody(req: VercelRequest): any {
  const raw: unknown = (req as any).body;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

// ── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-vercel-ip'] as string) || req.socket?.remoteAddress || '0.0.0.0';
  const authHeader = (req.headers['authorization'] as string) || '';

  const rl = await checkRateLimit(ip, authHeader);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Daily AI sentence limit reached', code: 'RATE_LIMIT' });
  }

  const body = readBody(req);
  const level = Number(body?.hskLevel);
  const difficulty = String(body?.difficulty || 'medium');
  const targetWordRaw = body?.targetWord;

  if (!VALID_LEVELS.has(level)) {
    return res.status(400).json({ error: 'hskLevel must be 1-4' });
  }
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be short, medium, or long' });
  }

  const targetWord =
    typeof targetWordRaw === 'string' && targetWordRaw.trim().length > 0 && targetWordRaw.length <= 20
      ? targetWordRaw.trim()
      : null;

  if (!DEEPSEEK_API_KEY) {
    console.error('[writing-ai] DEEPSEEK_API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured.' });
  }

  // Cache lookup — identical requests reuse a previously validated sentence.
  const cacheKey = createHash('sha256').update(`${level}|${difficulty}|${targetWord || 'any'}`).digest('hex');
  if (isRedisConfigured()) {
    try {
      const cached = await redisGet(CACHE_PREFIX + cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        return res.end(cached);
      }
    } catch {
      /* fall through */
    }
  }

  if (!(await circuitAllows())) {
    res.setHeader('Retry-After', '30');
    return res.status(503).json({ error: 'AI service temporarily unavailable', code: 'CIRCUIT_OPEN' });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const generated = await generateOnce({ level, difficulty, targetWord });
    if (!generated) continue;
    if (!(await validateScope(generated.sentence, level))) continue;

    await recordSuccess();

    const payload = JSON.stringify({
      sentence: generated.sentence,
      pinyin: generated.pinyin,
      translation: generated.translation,
      target_words: generated.target_words,
      hsk_level: level,
    });

    if (isRedisConfigured()) {
      try {
        await redisSet(CACHE_PREFIX + cacheKey, payload, CACHE_TTL_SECONDS);
      } catch {
        /* ignore cache write failures */
      }
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Content-Type', 'application/json');
    return res.end(payload);
  }

  return res.status(502).json({ error: 'Could not generate a valid sentence. Please try again.' });
}