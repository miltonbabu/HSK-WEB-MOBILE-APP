// Vercel Serverless Function — AI Chat Proxy
// Same logic as backend/server.js but deployed as a Vercel Function.
// DeepSeek API key is stored in Vercel Environment Variables (server-side only).
//
// Called by both web app (relative path /api/ai/chat) 
// and mobile app (full URL https://your-app.vercel.app/api/ai/chat).

import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ──
  const origin = req.headers.origin || '';
  const allowOrigin = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS[0] !== '*'
    ? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
    : '*';

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model, temperature, max_tokens } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (!DEEPSEEK_API_KEY) {
      console.error('[AI Proxy] DEEPSEEK_API_KEY not configured');
      return res.status(500).json({
        error: 'AI service not configured. Set DEEPSEEK_API_KEY in Vercel Environment Variables.',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages,
        stream: false,
        temperature: temperature ?? 0.5,
        max_tokens: max_tokens ?? 512,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[AI Proxy] DeepSeek error ${response.status}:`, errText.slice(0, 200));
      return res.status(response.status).json({
        error: `DeepSeek API returned ${response.status}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    console.error('[AI Proxy] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}