/**
 * Stations-PWA: neue Deployments zuverlässig (Network-First für App-Assets).
 * CACHE_NAME enthält __CACHE_BUILD_ID__ — wird beim Production-Build ersetzt.
 */

const CACHE_NAME = 'rabbit-technik-station-__CACHE_BUILD_ID__'

const CORE_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/pwa-192.svg', '/pwa-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        await cache.addAll(CORE_ASSETS).catch(() => {})
      } catch (_) {
        /* ignore */
      }
      // Erste Installation: sofort aktivieren. Updates: warten auf SKIP_WAITING (Tablet-Button).
      if (!self.registration.active) {
        await self.skipWaiting()
      }
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.map((k) => {
          if (k === CACHE_NAME) return Promise.resolve()
          if (isManagedCacheKey(k)) return caches.delete(k)
          return Promise.resolve()
        }),
      )
      await self.clients.claim()
    })(),
  )
})

function isManagedCacheKey(k) {
  return (
    k.startsWith('rabbit-technik-station-') ||
    k.startsWith('rt-station') ||
    /neonshift|neon-shift|neon/i.test(k)
  )
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  const accept = req.headers.get('accept') || ''
  const isNavigation = req.mode === 'navigate'
  const isHtml = accept.includes('text/html')
  const isAsset = url.pathname.startsWith('/assets/')

  if (isNavigation || isHtml || isAsset || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(req))
    return
  }

  event.respondWith(staleWhileRevalidate(req))
})

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const res = await fetch(req)
    if (res && res.ok && res.type === 'basic') {
      const accept = req.headers.get('accept') || ''
      const isHtml = accept.includes('text/html') || req.mode === 'navigate'
      if (!isHtml) {
        try {
          await cache.put(req, res.clone())
        } catch (_) {
          /* ignore */
        }
      }
    }
    return res
  } catch (_) {
    const c = await cache.match(req)
    if (c) return c
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(req)
  try {
    const res = await fetch(req)
    if (res.ok && res.type === 'basic') {
      cache.put(req, res.clone()).catch(() => {})
    }
    return res
  } catch (_) {
    if (cached) return cached
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
})
