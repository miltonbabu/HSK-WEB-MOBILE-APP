// Upstash Redis client for serverless shared state.
// HTTP-based (no persistent connections) — ideal for Vercel functions.
// When UPSTASH_REDIS_REST_URL/TOKEN are not set, `redis` is null and callers
// must fall back to in-memory state. This keeps the app working in dev and
// when Redis is intentionally not configured.

import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL || '';
const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const redis: Redis | null = url && token ? new Redis({ url, token }) : null;

export function isRedisConfigured(): boolean {
  return redis !== null;
}
