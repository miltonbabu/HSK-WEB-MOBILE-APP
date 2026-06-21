// Upstash Redis client for serverless shared state.
// Uses direct fetch() to the Upstash REST API instead of the @upstash/redis
// SDK — the SDK was causing FUNCTION_INVOCATION_FAILED on Vercel due to
// ESM/CJS bundling issues. Direct fetch is lighter, has zero dependencies,
// and works reliably in Vercel's Node.js runtime.
//
// When UPSTASH_REDIS_REST_URL/TOKEN are not set, all operations return
// null/false and callers must fall back to in-memory state.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export function isRedisConfigured(): boolean {
  return UPSTASH_URL.length > 0 && UPSTASH_TOKEN.length > 0;
}

// Upstash REST API uses POST with Authorization Bearer token.
// Commands are sent as JSON arrays: ["SET", "key", "value"]
// https://docs.upstash.com/redis/features/restapi

async function upstashExec(args: unknown[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('redis not configured');
  }
  const res = await fetch(`${UPSTASH_URL}`, {
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

export const redis = {
  async get<T = string>(key: string): Promise<T | null> {
    const result = await upstashExec(['GET', key]);
    return (result === null ? null : result) as T | null;
  },

  async set(key: string, value: string, opts?: { ex?: number }): Promise<string> {
    const args: unknown[] = ['SET', key, value];
    if (opts?.ex) {
      args.push('EX', opts.ex);
    }
    const result = await upstashExec(args);
    return result as string;
  },

  async incr(key: string): Promise<number> {
    const result = await upstashExec(['INCR', key]);
    return Number(result);
  },

  async expire(key: string, seconds: number): Promise<number> {
    const result = await upstashExec(['EXPIRE', key, seconds]);
    return Number(result);
  },

  async ttl(key: string): Promise<number> {
    const result = await upstashExec(['TTL', key]);
    return Number(result);
  },

  async del(key: string): Promise<number> {
    const result = await upstashExec(['DEL', key]);
    return Number(result);
  },

  async ping(): Promise<string> {
    const result = await upstashExec(['PING']);
    return result as string;
  },
};

export type RedisClient = typeof redis;
