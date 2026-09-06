const CACHE_PREFIX = 'the-goy-project-'
const CACHE_NAME = CACHE_PREFIX + '__BUILD_ID__'
const SCOPE = self.registration.scope
const scopePath = new URL(SCOPE).pathname
const CORE_ASSETS = ['','manifest.webmanifest','theme.js','favicon.png','apple-touch-icon.png','app-icon-192.png','app-icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const manifest = await fetch(new URL('precache.json', SCOPE), { cache: 'no-store' })
    if (!manifest.ok) throw new Error('App update unavailable')
    const assets = await manifest.json()
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll([...CORE_ASSETS, ...assets].map((path) => new URL(path, SCOPE).href))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return
  const navigation = event.request.mode === 'navigate'
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const key = navigation ? SCOPE : event.request
    const cached = await cache.match(key)
    if (!navigation && cached) return cached
    try {
      const response = await fetch(event.request)
      if (response.ok && response.type === 'basic') {
        event.waitUntil(cache.put(key, response.clone()))
      }
      return response
    } catch {
      return cached ?? Response.error()
    }
  })())
})
