// Vercel Serverless Function — Guest Identity
// Returns the visitor's IP address so the client can use it
// as a consistent guest ID across tabs/browsers for rate limiting.

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Vercel provides the real client IP in these headers
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-vercel-ip'] as string) ||
    req.socket.remoteAddress ||
    '0.0.0.0'

  return res.status(200).json({ ip, fingerprint: ip })
}