/**
 * SmartTime AI — PWA Service Worker (v1.0.8)
 * Network-First for dynamic app code so UI updates load immediately,
 * with reliable offline caching and background sync capabilities.
 */

const CACHE_NAME = 'smarttime-ai-v1.0.9';
const scope = self.registration ? self.registration.scope : './';
const STATIC_ASSETS = [
  scope,
  new URL('index.html', scope).pathname,
  new URL('css/base.css', scope).pathname,
  new URL('css/components.css', scope).pathname,
  new URL('css/animations.css', scope).pathname,
  new URL('css/pages.css', scope).pathname,
  new URL('js/app.js', scope).pathname,
  new URL('js/api.js', scope).pathname,
  new URL('js/state.js', scope).pathname,
  new URL('js/utils/dateUtils.js', scope).pathname,
  new URL('js/utils/audioUtils.js', scope).pathname,
  new URL('js/utils/csvUtils.js', scope).pathname,
  new URL('js/components/navbar.js', scope).pathname,
  new URL('js/components/dashboardView.js', scope).pathname,
  new URL('js/components/calendarView.js', scope).pathname,
  new URL('js/components/timetablesView.js', scope).pathname,
  new URL('js/components/notificationsView.js', scope).pathname,
  new URL('js/components/settingsView.js', scope).pathname,
  new URL('js/components/addScheduleWizard.js', scope).pathname,
  new URL('js/components/alarmModal.js', scope).pathname,
  new URL('js/components/cameraModal.js', scope).pathname,
  new URL('js/components/toast.js', scope).pathname,
  new URL('manifest.json', scope).pathname,
  new URL('icons/icon.svg', scope).pathname,
  new URL('icons/icon-192.png', scope).pathname,
  new URL('icons/icon-512.png', scope).pathname,
  new URL('icons/apple-touch-icon.png', scope).pathname
];

// Install Event — Cache Core Shell & skipWaiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Caching warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event — Purge ALL Old Caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event — Network-First for fresh updates, offline fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // API calls: Network-First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-First for JS and CSS scripts to prevent stale UI views
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Network offline and asset not cached', { status: 503 });
        });
      })
  );
});
