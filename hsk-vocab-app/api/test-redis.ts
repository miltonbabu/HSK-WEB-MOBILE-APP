// Test endpoint to verify direct Upstash fetch() works.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export default async function handler(req: any, res: any) {
  try {
    const pingRes = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['PING']),
    });
    const pingText = await pingRes.text();
    res.status(200).json({
      ok: true,
      status: pingRes.status,
      ping: pingText,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
