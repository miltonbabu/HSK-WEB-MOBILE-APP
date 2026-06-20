import { describe, it, expect } from 'vitest';
import { getCircuitState, recordSuccess, recordFailure } from '../circuit-breaker';

// These tests exercise the in-memory fallback path (no Redis configured in CI).

describe('circuit-breaker (in-memory fallback)', () => {
  it('starts in closed state and allows requests', async () => {
    // Use a unique IP to avoid cross-test contamination from shared in-memory state.
    // The circuit breaker is global (not per-IP), so we reset by recording a success.
    await recordSuccess();
    const state = await getCircuitState();
    expect(state.allow).toBe(true);
  });

  it('opens after 5 consecutive failures', async () => {
    await recordSuccess(); // reset to closed
    for (let i = 0; i < 5; i++) {
      await recordFailure();
    }
    const state = await getCircuitState();
    expect(state.allow).toBe(false);
    expect(state.state).toBe('open');
  });

  it('closes immediately on success after being closed', async () => {
    await recordFailure();
    await recordSuccess();
    const state = await getCircuitState();
    expect(state.allow).toBe(true);
  });

  it('does not open on fewer than 5 failures', async () => {
    await recordSuccess(); // reset
    await recordFailure();
    await recordFailure();
    await recordFailure();
    await recordFailure();
    const state = await getCircuitState();
    expect(state.allow).toBe(true);
    expect(state.state).toBe('closed');
  });
});
