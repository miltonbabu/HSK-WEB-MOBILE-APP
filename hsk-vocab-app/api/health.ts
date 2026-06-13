// Vercel Serverless Function — Health Check
// Returns OK status for monitoring / uptime checks.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ status: 'ok', timestamp: Date.now() });
}