// XueTong service worker — offline-first PWA.
//
// Strategies:
//   - App shell (navigations) → network-first, fall back to cache.
//   - Static hashed assets (Vite emits `/assets/*.js` etc.) → cache-first.
//   - HSK vocab JSON files → cache-first (large, immutable per release).
//   - Other GETs → network-first with 3s timeout, fall back to cache.
//
// The SW is registered manually in main.tsx (production only) so
// dev/HMR works without interference.

const VERSION = 'hsk-v1.0.0'
const SHELL_CACHE = `hsk-shell-${VERSION}`
const STATIC_CACHE = `hsk-static-${VERSION}`
const DATA_CACHE = `hsk-data-${VERSION}`

// Files that absolutely must be available offline. We pre-cache them
// on `install`; failures are non-fatal so a transient 404 on a font
// icon won't block the worker.
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
]

const isVocabJson = /\/hsk_(level_\d+|vocabulary_complete)\.json$/
const isHashedAsset = /\.(?:js|css|woff2?|svg|png|webp|ico)$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  // Drop any caches from older versions.
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('hsk-') && k !== SHELL_CACHE && k !== STATIC_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const fresh = await fetch(request)
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {})
    return fresh
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('offline and no cached response')
  }
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const fresh = await fetch(request, { signal: controller.signal })
    clearTimeout(timer)
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {})
    return fresh
  } catch {
    clearTimeout(timer)
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('offline and no cached response')
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const fresh = await fetch(request)
  if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {})
  return fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // ignore cross-origin (e.g. HuggingFace CDN)

  // 1. App shell: navigations always try the network first.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }

  // 2. HSK vocab JSON — large but stable; cache-first.
  if (isVocabJson.test(url.pathname)) {
    event.respondWith(cacheFirst(request, DATA_CACHE))
    return
  }

  // 3. Hashed/static assets — cache-first (Vite emits content-hashed
  //    URLs that are safe to cache forever).
  if (isHashedAsset.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // 4. Default: network-first with a short timeout so a slow upstream
  //    doesn't stall the UI.
  event.respondWith(networkFirstWithTimeout(request, STATIC_CACHE, 3000))
})
