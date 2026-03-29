// ═══════════════════════════════════════════════════════════════
//  Nirvana Mart Service Worker v1.0
//  Strategy:  Cache-first for static assets
//             Network-first for API calls (offline fallback = empty JSON)
//             Offline fallback = 404.html
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'nirvanamart-v1';
const OFFLINE_PAGE = '/404.html';

// Static shell assets — cache on install
const PRECACHE = [
  '/index.html',
  '/shop.html',
  '/login.html',
  '/register.html',
  '/buyer.html',
  '/seller.html',
  '/404.html',
  '/shared/css/main.css',
  '/shared/js/auth.js',
  '/shared/js/api.js',
  '/shared/js/effects.js',
  '/shared/js/notifications.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/manifest.webmanifest',
];

// ─── Install: pre-cache shell ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
    }).catch((err) => {
      console.warn('[SW] Pre-cache failed (some files may not exist yet):', err);
    })
  );
  self.skipWaiting(); // activate immediately
});

// ─── Activate: clear old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim(); // take control of all tabs immediately
});

// ─── Fetch: routing strategy ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, DELETE etc)
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (CDNs, external APIs)
  if (url.origin !== location.origin) return;

  // ── API calls: Network-first, fallback to empty response ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'You are offline. Please reconnect.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // ── Static assets: Cache-first, update cache in background ──
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached version immediately if available
      if (cachedResponse) {
        // Background revalidation (stale-while-revalidate pattern)
        fetch(request).then((freshResponse) => {
          if (freshResponse && freshResponse.status === 200) {
            const responseToCache = freshResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
        }).catch(() => {}); // Ignore revalidation errors
        return cachedResponse;
      }

      // Not in cache – fetch from network, cache for next time
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return response;
      }).catch(() => {
        // Full offline fallback — serve the offline page for HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match(OFFLINE_PAGE);
        }
      });
    })
  );
});

// ─── Push Notifications (future-ready stub) ───────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Nirvana Mart', body: 'You have a new notification!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      tag: 'nirvanamart-notif',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/buyer.html'));
});
