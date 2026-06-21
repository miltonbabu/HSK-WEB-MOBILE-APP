// XueTong PWA service worker.
// Caches the app shell so the app boots offline and feels like a native app
// when launched from the home screen.

const CACHE = 'xuetong-v3'
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
  '/hsk_vocabulary_complete.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] precache failed for', url, err)
          })
        )
      )
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Never cache API calls — always go to network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/functions/')) {
    return
  }

  // For navigations (HTML), use network-first with cache fallback so
  // users always see the latest app shell when online.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(CACHE)
          cache.put(req, fresh.clone())
          return fresh
        } catch {
          const cache = await caches.open(CACHE)
          const cached = (await cache.match(req)) || (await cache.match('/'))
          if (cached) return cached
          throw new Error('Offline and no cached page')
        }
      })()
    )
    return
  }

  // Static assets (JS, CSS, images, fonts) — cache-first.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      if (cached) {
        // Refresh in background.
        fetch(req).then((fresh) => {
          if (fresh && fresh.ok) cache.put(req, fresh.clone())
        }).catch(() => {})
        return cached
      }
      try {
        const fresh = await fetch(req)
        if (fresh && fresh.ok && (url.origin === self.location.origin)) {
          cache.put(req, fresh.clone())
        }
        return fresh
      } catch (err) {
        return new Response('Offline', { status: 503, statusText: 'Offline' })
      }
    })()
  )
})
