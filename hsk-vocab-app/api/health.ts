// Simple health check endpoint — no external dependencies.
// Used to verify Vercel functions are working at all.
export default function handler(req: any, res: any) {
  res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    node: process.version,
    hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    hasDeepseekKey: !!process.env.DEEPSEEK_API_KEY,
  });
}
