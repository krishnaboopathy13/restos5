/**
 * RestOS — Service Worker
 * Enables full offline support for the PWA
 *
 * Strategy:
 *   - Cache-first for the HTML app shell (index.html)
 *   - Cache-first for CDN assets (Chart.js, fonts)
 *   - Network-first for API calls (Claude, Supabase)
 *   - Serve stale content when offline
 */

const CACHE_NAME    = 'restos-v4.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap',
];

// Install — pre-cache app shell
self.addEventListener('install', function(event) {
  console.log('[SW] Installing RestOS v4.1');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function(err) {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
  console.log('[SW] RestOS v4.1 active');
});

// Fetch — smart routing
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // API calls → network only (never cache sensitive data)
  if (url.includes('/api/') ||
      url.includes('anthropic.com') ||
      url.includes('supabase.co') ||
      url.includes('razorpay.com')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(
          JSON.stringify({ error: 'Offline — API unavailable' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // App shell + static → Cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback — serve app shell for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Background sync placeholder (for future order sync when back online)
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-orders') {
    console.log('[SW] Background sync: orders');
  }
});

// Push notification placeholder
self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {};
  self.registration.showNotification(data.title || 'RestOS', {
    body:    data.body || 'New notification',
    icon:    '/icon-192.png',
    badge:   '/badge.png',
    vibrate: [200, 100, 200],
  });
});
