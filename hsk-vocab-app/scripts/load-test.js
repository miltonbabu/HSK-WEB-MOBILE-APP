#!/usr/bin/env node
// Load test for the /api/ai/chat endpoint.
// Simulates concurrent users hitting the AI proxy with a mix of cached and
// uncached prompts to verify rate limiting, caching, and circuit breaker
// behavior under load.
//
// Usage:
//   node scripts/load-test.js [concurrentUsers] [durationSeconds]
//
// Defaults: 200 concurrent users for 30 seconds (use lower values against dev).
// For a true 10k test, run from a distributed load generator (k6/Artillery),
// not a single Node process — Node's HTTP concurrency is limited.

const http = require('http');

const TARGET = process.env.LOAD_TEST_TARGET || 'http://localhost:5173';
const CONCURRENT = parseInt(process.argv[2] || '200', 10);
const DURATION_S = parseInt(process.argv[3] || '30', 10);

const PROMPTS = [
  { messages: [{ role: 'user', content: 'Translate 报名 to English' }], stream: false },
  { messages: [{ role: 'user', content: 'Generate a quiz for HSK 4 word 报名' }], stream: false },
  { messages: [{ role: 'user', content: 'Explain the grammar of 把 sentence' }], stream: false },
  { messages: [{ role: 'user', content: 'What is the pinyin for 学习?' }], stream: false },
];

const stats = {
  total: 0,
  success: 0,
  errors: 0,
  rateLimited: 0,
  circuitOpen: 0,
  cacheHits: 0,
  cacheMisses: 0,
  latencies: [],
};

function makeRequest() {
  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  const body = JSON.stringify({ ...prompt, model: 'deepseek-chat', temperature: 0.5, max_tokens: 512 });
  const start = Date.now();
  const url = new URL(TARGET + '/api/ai/chat');

  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const latency = Date.now() - start;
        stats.latencies.push(latency);
        stats.total++;
        if (res.statusCode === 200) {
          stats.success++;
          if (res.headers['x-cache'] === 'HIT') stats.cacheHits++;
          else stats.cacheMisses++;
        } else if (res.statusCode === 429) {
          stats.rateLimited++;
        } else if (res.statusCode === 503) {
          stats.circuitOpen++;
        } else {
          stats.errors++;
        }
        if (Date.now() - START < DURATION_S * 1000) scheduleNext();
      });
    }
  );
  req.on('error', () => {
    stats.errors++;
    stats.total++;
    if (Date.now() - START < DURATION_S * 1000) scheduleNext();
  });
  req.write(body);
  req.end();
}

function scheduleNext() {
  setTimeout(makeRequest, Math.random() * 100);
}

const START = Date.now();
console.log(`Load test: ${CONCURRENT} concurrent users for ${DURATION_S}s against ${TARGET}`);
for (let i = 0; i < CONCURRENT; i++) scheduleNext();

setTimeout(() => {
  const elapsed = (Date.now() - START) / 1000;
  const latencies = stats.latencies.sort((a, b) => a - b);
  const p = (pct) => latencies[Math.floor(latencies.length * pct)] || 0;
  console.log('\n── Load Test Results ──');
  console.log(`Duration:        ${elapsed.toFixed(1)}s`);
  console.log(`Total requests:  ${stats.total}`);
  console.log(`Success (200):   ${stats.success}`);
  console.log(`Rate limited:    ${stats.rateLimited}`);
  console.log(`Circuit open:    ${stats.circuitOpen}`);
  console.log(`Errors:          ${stats.errors}`);
  console.log(`Cache hits:      ${stats.cacheHits} (${stats.total ? ((stats.cacheHits / stats.total) * 100).toFixed(1) : 0}%)`);
  console.log(`Cache misses:    ${stats.cacheMisses}`);
  console.log(`p50 latency:     ${p(0.5)}ms`);
  console.log(`p95 latency:     ${p(0.95)}ms`);
  console.log(`p99 latency:     ${p(0.99)}ms`);
  console.log(`Error rate:      ${stats.total ? ((stats.errors / stats.total) * 100).toFixed(1) : 0}%`);
  process.exit(0);
}, DURATION_S * 1000 + 2000);
