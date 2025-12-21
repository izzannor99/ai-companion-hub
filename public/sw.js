const CACHE_NAME = 'arachat-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests (except fonts)
  if (!url.origin.includes(self.location.origin) && !url.href.includes('fonts.googleapis.com') && !url.href.includes('fonts.gstatic.com')) {
    return;
  }

  // For navigation requests (HTML), use network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // For other assets, use stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            // Only cache successful responses
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      });
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
