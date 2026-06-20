// Circuit breaker for the DeepSeek upstream.
// Shared across all Vercel instances via Redis — when one instance sees
// DeepSeek fail, all instances skip the upstream until it recovers.
//
// States:
//   closed    → requests flow through; failures are counted
//   open      → requests fail-fast (503); no DeepSeek calls for COOLDOWN_MS
//   half-open → one probe request allowed; success closes, failure re-opens
//
// Open threshold: FAILURE_THRESHOLD consecutive failures within 60s.
// Cooldown: COOLDOWN_MS before transitioning to half-open.

import { redis, isRedisConfigured } from './redis';

const CB_KEY = 'cb:deepseek';
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30_000;

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  openedAt: number; // ms epoch when opened
}

// ── In-memory fallback ──
let memState: CircuitRecord = { state: 'closed', failures: 0, openedAt: 0 };

function readMem(): CircuitRecord {
  const now = Date.now();
  if (memState.state === 'open' && now - memState.openedAt > COOLDOWN_MS) {
    memState = { ...memState, state: 'half-open' };
  }
  return memState;
}

function writeMem(rec: CircuitRecord): void {
  memState = rec;
}

async function readRedis(): Promise<CircuitRecord> {
  if (!redis) throw new Error('redis not configured');
  const raw = await redis.get<string>(CB_KEY);
  if (!raw) return { state: 'closed', failures: 0, openedAt: 0 };
  const rec = typeof raw === 'string' ? (JSON.parse(raw) as CircuitRecord) : (raw as unknown as CircuitRecord);
  // Auto-transition open → half-open after cooldown.
  if (rec.state === 'open' && Date.now() - rec.openedAt > COOLDOWN_MS) {
    rec.state = 'half-open';
  }
  return rec;
}

async function writeRedis(rec: CircuitRecord): Promise<void> {
  if (!redis) throw new Error('redis not configured');
  // Persist for 1 hour max so stale state doesn't linger if no traffic.
  await redis.set(CB_KEY, JSON.stringify(rec), { ex: 3600 });
}

export interface CircuitDecision {
  allow: boolean;
  state: CircuitState;
}

export async function getCircuitState(): Promise<CircuitDecision> {
  try {
    if (!isRedisConfigured()) throw new Error('redis not configured');
    const rec = await readRedis();
    if (rec.state === 'open') {
      return { allow: false, state: 'open' };
    }
    return { allow: true, state: rec.state }; // closed or half-open
  } catch {
    const rec = readMem();
    if (rec.state === 'open') return { allow: false, state: 'open' };
    return { allow: true, state: rec.state };
  }
}

export async function recordSuccess(): Promise<void> {
  try {
    if (!isRedisConfigured()) throw new Error('redis not configured');
    await writeRedis({ state: 'closed', failures: 0, openedAt: 0 });
  } catch {
    writeMem({ state: 'closed', failures: 0, openedAt: 0 });
  }
}

export async function recordFailure(): Promise<void> {
  // Any failure in half-open immediately re-opens the circuit.
  // In closed, count failures; open when threshold reached.
  const persist = async (rec: CircuitRecord) => {
    try {
      if (!isRedisConfigured()) throw new Error('redis not configured');
      await writeRedis(rec);
    } catch {
      writeMem(rec);
    }
  };

  let current: CircuitRecord;
  try {
    if (!isRedisConfigured()) throw new Error('redis not configured');
    current = await readRedis();
  } catch {
    current = readMem();
  }

  if (current.state === 'half-open') {
    await persist({ state: 'open', failures: current.failures + 1, openedAt: Date.now() });
    return;
  }

  const failures = current.failures + 1;
  if (failures >= FAILURE_THRESHOLD) {
    await persist({ state: 'open', failures, openedAt: Date.now() });
  } else {
    await persist({ state: 'closed', failures, openedAt: 0 });
  }
}
