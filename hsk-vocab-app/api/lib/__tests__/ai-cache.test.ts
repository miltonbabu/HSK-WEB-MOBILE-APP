import { describe, it, expect } from 'vitest';
import { deriveCacheKey, shouldBypassCache } from '../ai-cache';

describe('deriveCacheKey', () => {
  it('produces the same key for identical inputs', () => {
    const params = {
      model: 'deepseek-chat',
      temperature: 0.5,
      max_tokens: 512,
      messages: [{ role: 'user', content: 'Translate 报名' }],
    };
    const key1 = deriveCacheKey(params);
    const key2 = deriveCacheKey(params);
    expect(key1).toBe(key2);
  });

  it('produces different keys for different messages', () => {
    const base = {
      model: 'deepseek-chat',
      temperature: 0.5,
      max_tokens: 512,
    };
    const key1 = deriveCacheKey({ ...base, messages: [{ role: 'user', content: 'A' }] });
    const key2 = deriveCacheKey({ ...base, messages: [{ role: 'user', content: 'B' }] });
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different temperatures', () => {
    const base = {
      model: 'deepseek-chat',
      max_tokens: 512,
      messages: [{ role: 'user', content: 'hi' }],
    };
    const key1 = deriveCacheKey({ ...base, temperature: 0.3 });
    const key2 = deriveCacheKey({ ...base, temperature: 0.7 });
    expect(key1).not.toBe(key2);
  });

  it('produces a 64-character hex string (sha256)', () => {
    const key = deriveCacheKey({
      model: 'deepseek-chat',
      temperature: 0.5,
      max_tokens: 512,
      messages: [],
    });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('shouldBypassCache', () => {
  it('returns true for time-sensitive prompts', () => {
    expect(shouldBypassCache([{ role: 'user', content: 'What time is it?' }])).toBe(true);
    expect(shouldBypassCache([{ role: 'user', content: 'Tell me about today' }])).toBe(true);
    expect(shouldBypassCache([{ role: 'user', content: 'What is happening now?' }])).toBe(true);
  });

  it('returns true when the prompt contains today\'s date', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(shouldBypassCache([{ role: 'user', content: `Log for ${today}` }])).toBe(true);
  });

  it('returns false for evergreen prompts', () => {
    expect(shouldBypassCache([{ role: 'user', content: 'Translate 报名 to English' }])).toBe(false);
    expect(shouldBypassCache([{ role: 'user', content: 'Generate a quiz for HSK 4' }])).toBe(false);
  });

  it('returns false for non-string content', () => {
    expect(shouldBypassCache([{ role: 'user', content: 42 }])).toBe(false);
    expect(shouldBypassCache([])).toBe(false);
  });
});
