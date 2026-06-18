// XueTong PWA Service Worker
const CACHE_NAME = 'xuetong-v2'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  const url = new URL(event.request.url)
  const isNavigation = event.request.mode === 'navigate'
  const isHashedAsset = url.pathname.startsWith('/assets/')

  // Network-first for navigation requests (HTML documents).
  // Ensures users always get the latest HTML after a deployment, which
  // references the correct chunk hashes. Falls back to cache only when
  // offline. This fixes the "Failed to fetch dynamically imported module"
  // error caused by stale cached HTML pointing to deleted chunk files.
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          }
          return response
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
        )
    )
    return
  }

  // Cache-first for hashed assets (immutable, content-addressed by Vite).
  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    )
    return
  }

  // Stale-while-revalidate for everything else (JSON data, icons, etc.)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          }
          return response
        })
        .catch(() => cached)
      return cached || networkFetch
    })
  )
})
