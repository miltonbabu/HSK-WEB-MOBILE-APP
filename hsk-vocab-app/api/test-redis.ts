// Minimal endpoint to isolate whether Vercel functions work at all.
// No external imports.
export default async function handler(req: any, res: any) {
  res.status(200).json({
    ok: true,
    message: 'hello from vercel function',
    url: process.env.UPSTASH_REDIS_REST_URL ? 'has url' : 'no url',
    token: process.env.UPSTASH_REDIS_REST_TOKEN ? 'has token' : 'no token',
  });
}
