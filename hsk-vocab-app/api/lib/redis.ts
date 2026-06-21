// Upstash Redis client for serverless shared state.
// Uses direct fetch() to the Upstash REST API — the @upstash/redis SDK caused
// FUNCTION_INVOCATION_FAILED on Vercel due to bundling issues.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export function isRedisConfigured(): boolean {
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

export async function redisGet(key: string): Promise<string | null> {
  const result = await upstashExec(['GET', key]);
  return result === null ? null : String(result);
}

export async function redisSet(key: string, value: string, ex?: number): Promise<void> {
  const args: unknown[] = ['SET', key, value];
  if (ex) args.push('EX', ex);
  await upstashExec(args);
}

export async function redisIncr(key: string): Promise<number> {
  return Number(await upstashExec(['INCR', key]));
}

export async function redisExpire(key: string, seconds: number): Promise<void> {
  await upstashExec(['EXPIRE', key, seconds]);
}

export async function redisTtl(key: string): Promise<number> {
  return Number(await upstashExec(['TTL', key]));
}

export async function redisDel(key: string): Promise<void> {
  await upstashExec(['DEL', key]);
}

export async function redisPing(): Promise<string> {
  return String(await upstashExec(['PING']));
}
