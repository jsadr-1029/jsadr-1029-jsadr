// sw.js — Service Worker para Jsadr
// Cache control: network-first para HTML, cache-first para assets estáticos
// SKIP_WAITING activado para que las actualizaciones se apliquen inmediatamente

const CACHE_NAME = 'jsadr-v3-2026-11-03'
const STATIC_CACHE = `${CACHE_NAME}-static`

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([
      '/',
      '/manifest.webmanifest',
    ])).catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_NAME))
          .map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo manejar GET
  if (request.method !== 'GET') return

  // No interceptar API calls — siempre ir a la red
  if (url.pathname.startsWith('/api/')) return

  // Network-first para HTML (para que siempre tenga la versión más reciente)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Cache-first para assets estáticos (JS, CSS, imágenes, fuentes)
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone))
          }
          return response
        })
      })
    )
    return
  }
})
