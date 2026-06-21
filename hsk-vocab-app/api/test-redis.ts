// Test endpoint that imports our real redis module.
import { redis, isRedisConfigured } from './lib/redis';

export default async function handler(req: any, res: any) {
  try {
    const configured = isRedisConfigured();
    let pingResult = 'skipped';
    if (configured && redis) {
      pingResult = await redis.ping();
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
