// Test endpoint that imports the real redis module (function-based API).
import { isRedisConfigured, redisPing } from './lib/redis';

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
