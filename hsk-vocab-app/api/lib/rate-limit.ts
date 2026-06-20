// Shared rate limiting backed by Upstash Redis.
// Falls back to in-memory Map when Redis is unavailable (fail-open philosophy
// matches the existing RateLimitGuard — never block users on infra failure).
//
// Tiers:
//   - Anonymous (no Bearer token): 30 req/min keyed by IP
//   - Authenticated (Bearer token): 120 req/min keyed by token hash
//
// Implementation: fixed-window counter via atomic INCR + EXPIRE.
// Good enough for this use case; a true sliding window would need a sorted
// set and is overkill here.

import { redis, isRedisConfigured } from './redis';
import crypto from 'crypto';

const ANON_LIMIT = 30;
const AUTH_LIMIT = 120;
const WINDOW_SECONDS = 60;

// ── In-memory fallback (per-instance, lost on cold start) ──
const memHits = new Map<string, { count: number; resetAt: number }>();

function memCheck(key: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = memHits.get(key);
  if (!entry || now >= entry.resetAt) {
    memHits.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    return { allowed: true, remaining: limit - 1, resetAt: now + WINDOW_SECONDS * 1000 };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

async function redisCheck(key: string, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (!redis) throw new Error('redis not configured');
  const redisKey = `rate:${key}`;
  // Atomic: INCR, then EXPIRE only on first hit of the window.
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, WINDOW_SECONDS);
  }
  const ttl = await redis.ttl(redisKey);
  const resetAt = Date.now() + (ttl > 0 ? ttl : WINDOW_SECONDS) * 1000;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds, 0 if allowed
}

export async function checkRateLimit(ip: string, authHeader: string): Promise<RateLimitResult> {
  const hasUserToken = authHeader.startsWith('Bearer ') && authHeader.length > 20;
  const bucketKey = hasUserToken
    ? `user:${crypto.createHash('sha256').update(authHeader).digest('hex').slice(0, 16)}`
    : `ip:${ip}`;
  const limit = hasUserToken ? AUTH_LIMIT : ANON_LIMIT;

  try {
    if (!isRedisConfigured()) throw new Error('redis not configured');
    const r = await redisCheck(bucketKey, limit);
    return {
      allowed: r.allowed,
      remaining: r.remaining,
      retryAfter: r.allowed ? 0 : Math.ceil((r.resetAt - Date.now()) / 1000),
    };
  } catch {
    // Fallback to in-memory. Fail-open: if even the in-memory check throws,
    // allow the request.
    try {
      const r = memCheck(bucketKey, limit);
      return {
        allowed: r.allowed,
        remaining: r.remaining,
        retryAfter: r.allowed ? 0 : Math.ceil((r.resetAt - Date.now()) / 1000),
      };
    } catch {
      return { allowed: true, remaining: limit, retryAfter: 0 };
    }
  }
}
