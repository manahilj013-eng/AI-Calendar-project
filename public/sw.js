/**
 * SmartTime AI — PWA Service Worker (v1.0.8)
 * Network-First for dynamic app code so UI updates load immediately,
 * with reliable offline caching and background sync capabilities.
 */

const CACHE_NAME = 'smarttime-ai-v1.0.8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/components.css',
  '/css/animations.css',
  '/css/pages.css',
  '/js/app.js',
  '/js/api.js',
  '/js/state.js',
  '/js/utils/dateUtils.js',
  '/js/utils/audioUtils.js',
  '/js/components/navbar.js',
  '/js/components/dashboardView.js',
  '/js/components/calendarView.js',
  '/js/components/timetablesView.js',
  '/js/components/notificationsView.js',
  '/js/components/settingsView.js',
  '/js/components/addScheduleWizard.js',
  '/js/components/alarmModal.js',
  '/js/components/cameraModal.js',
  '/js/components/toast.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
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
