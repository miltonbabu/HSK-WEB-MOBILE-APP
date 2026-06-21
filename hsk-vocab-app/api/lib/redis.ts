// Upstash Redis client for serverless shared state.
// HTTP-based (no persistent connections) — ideal for Vercel functions.
// When UPSTASH_REDIS_REST_URL/TOKEN are not set, `redis` is null and callers
// must fall back to in-memory state. This keeps the app working in dev and
// when Redis is intentionally not configured.

import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL || '';
const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';

// Wrap in try-catch so a bad URL/token never crashes the function at
// module-load time (which would cause FUNCTION_INVOCATION_FAILED on Vercel).
let _redis: Redis | null = null;
try {
  if (url && token) {
    _redis = new Redis({ url, token });
  }
} catch (err) {
  console.warn('[redis] Failed to initialize client:', err);
}

export const redis: Redis | null = _redis;

export function isRedisConfigured(): boolean {
  return redis !== null;
}
