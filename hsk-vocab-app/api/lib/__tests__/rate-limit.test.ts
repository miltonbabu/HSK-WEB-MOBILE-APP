import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limit';

// These tests exercise the in-memory fallback path (no Redis configured in CI).
// Redis-backed behavior is identical in logic; only the storage differs.

describe('checkRateLimit (in-memory fallback)', () => {
  it('allows requests under the anonymous limit', async () => {
    const ip = '192.0.2.1';
    for (let i = 0; i < 29; i++) {
      const r = await checkRateLimit(ip, '');
      expect(r.allowed).toBe(true);
    }
  });

  it('blocks the 31st request from the same anonymous IP', async () => {
    const ip = '192.0.2.2';
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(ip, '');
    }
    const r = await checkRateLimit(ip, '');
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it('gives authenticated users a higher limit (120/min)', async () => {
    const ip = '192.0.2.3';
    const token = 'Bearer ' + 'x'.repeat(30);
    for (let i = 0; i < 120; i++) {
      const r = await checkRateLimit(ip, token);
      expect(r.allowed).toBe(true);
    }
    const r = await checkRateLimit(ip, token);
    expect(r.allowed).toBe(false);
  });

  it('tracks anonymous and authenticated buckets separately', async () => {
    const ip = '192.0.2.4';
    const token = 'Bearer ' + 'y'.repeat(30);
    // Exhaust the anonymous bucket.
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(ip, '');
    }
    // Authenticated bucket on the same IP should still be allowed.
    const r = await checkRateLimit(ip, token);
    expect(r.allowed).toBe(true);
  });

  it('returns retryAfter=0 when allowed', async () => {
    const r = await checkRateLimit('192.0.2.5', '');
    expect(r.allowed).toBe(true);
    expect(r.retryAfter).toBe(0);
  });
});
