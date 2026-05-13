/* Minimaler Service Worker für Installierbarkeit + Offline-Basis.
   Wichtig: keine App-Logik hier, nur statische Assets.
*/

const CACHE_NAME = 'rt-station-sw-v2'
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192.svg',
  '/pwa-512.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Nur same-origin Assets cachen; API nicht anfassen.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        // HTML nicht aggressiv cachen (SPA), statische Dateien ja.
        if (res.ok && !req.headers.get('accept')?.includes('text/html')) {
          cache.put(req, res.clone())
        }
        return res
      } catch (e) {
        if (cached) return cached
        throw e
      }
    })(),
  )
})

