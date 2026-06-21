// Test endpoint with all Redis code inlined (no subdirectory import).
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

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

async function redisPing(): Promise<string> {
  return String(await upstashExec(['PING']));
}

export default async function handler(req: any, res: any) {
  try {
    const configured = isRedisConfigured();
    let pingResult = 'skipped';
    if (configured) {
      pingResult = await redisPing();
    }
    res.status(200).json({
      ok: true,
      redisConfigured: configured,
      redisPing: pingResult,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
