// Server-side AI response cache backed by Upstash Redis.
// Cuts DeepSeek calls dramatically for repetitive prompts (HSK vocab
// questions, sentence validations, quiz generations are highly repetitive
// across users).
//
// Cache key: sha256(model + temperature + max_tokens + JSON.stringify(messages))
// — deterministic, so identical prompts hit the cache regardless of caller.
//
// TTL: 24 hours (HSK content is evergreen).
//
// Streaming caveat: we only cache fully-assembled text, never partial SSE
// chunks. On a cache hit we return the assembled text as a single non-streaming
// JSON response. This is an acceptable tradeoff — chat latency on a hit is
// ~20ms vs 2-5s for a fresh DeepSeek call.

import { redis, isRedisConfigured } from './redis';
import crypto from 'crypto';

const CACHE_TTL_SECONDS = 86_400; // 24h
const CACHE_PREFIX = 'cache:ai:';

export function deriveCacheKey(params: {
  model: string;
  temperature: number;
  max_tokens: number;
  messages: unknown[];
}): string {
  // Normalize: stable JSON ordering, trim whitespace in string messages.
  const normalized = {
    model: params.model,
    temperature: params.temperature,
    max_tokens: params.max_tokens,
    messages: params.messages,
  };
  const json = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(json).digest('hex');
}

// Heuristic: skip caching if the last user message looks time-sensitive
// (contains "time", today's date, or a nonce-like number).
export function shouldBypassCache(messages: unknown[]): boolean {
  const last = messages[messages.length - 1];
  if (typeof last !== 'object' || last === null) return false;
  const content = (last as { content?: unknown }).content;
  if (typeof content !== 'string') return false;
  const today = new Date().toISOString().slice(0, 10);
  if (content.includes(today)) return true;
  return /\b(current|today|now|time)\b/i.test(content);
}

export async function getCachedResponse(cacheKey: string): Promise<string | null> {
  if (!isRedisConfigured() || !redis) return null;
  try {
    const hit = await redis.get<string>(CACHE_PREFIX + cacheKey);
    return typeof hit === 'string' ? hit : null;
  } catch (err) {
    console.warn('[ai-cache] get failed:', err);
    return null;
  }
}

export async function setCachedResponse(cacheKey: string, response: string): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  try {
    await redis.set(CACHE_PREFIX + cacheKey, response, { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.warn('[ai-cache] set failed:', err);
  }
}
