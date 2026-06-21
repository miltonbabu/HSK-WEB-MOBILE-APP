// Test endpoint with redis functions defined inline.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function upstashExec(args: unknown[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json() as { result?: unknown };
  return data.result;
}

export default async function handler(req: any, res: any) {
  try {
    const pong = await upstashExec(['PING']);
    res.status(200).json({ ok: true, ping: pong });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
