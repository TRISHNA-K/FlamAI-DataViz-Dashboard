// Production-Ready Service Worker for Telemetry Pulse Dashboard
// Implements Cache-First for static assets, Stale-While-Revalidate for APIs,
// and offline telemetry baseline caching.

const CACHE_NAME = 'telemetry-pwa-v1';

const STATIC_PRECACHE_URLS = [
  '/dashboard',
  '/manifest.json',
  '/workers/dataWorker.js',
  '/api/configurations/line-chart',
  '/api/configurations/scatter-plot',
  '/api/configurations/bar-chart',
  '/api/configurations/heatmap',
];

// 1. Install Event: Pre-cache critical application shell & worker assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_PRECACHE_URLS).catch((err) => {
          console.warn('[SW] Non-critical precache fetch skipped during install:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Multi-tiered caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // A. Static Asset Cache-First (Next.js chunks, workers, manifest, images)
  if (
    url.pathname.includes('/_next/static/') ||
    url.pathname.startsWith('/workers/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // B. Chart Configs & API: Stale-While-Revalidate with Offline Fallback
  if (url.pathname.startsWith('/api/configurations') || url.pathname.startsWith('/api/data')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Network failed, return cached response if available
              return cachedResponse;
            });

          // Return cached response immediately if available, otherwise await network
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // C. Default: Network with Cache Fallback for HTML navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/dashboard');
      })
    );
  }
});
