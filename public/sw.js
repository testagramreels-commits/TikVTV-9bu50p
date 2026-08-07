/* ============================================================
   TikTV Service Worker — Cache-First for assets, Network-First for API
   ============================================================ */

const CACHE_NAME   = 'tikvtv-v3';
const API_PREFIXES = [
  'iptv-org.github.io/api',
  'iptv-org.github.io/iptv',
  'raw.githubusercontent.com',
  'ui-avatars.com',
];

// App shell — cached on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(APP_SHELL).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET, chrome-extension, and HLS streams (don't cache video)
  if (request.method !== 'GET') return;
  if (url.startsWith('chrome-extension://')) return;
  if (url.includes('.m3u8') || url.includes('.ts') || url.includes('.aac')) return;
  if (url.includes('youtube.com') || url.includes('twitch.tv')) return;

  // API calls: Network-First with cache fallback
  const isAPI = API_PREFIXES.some(p => url.includes(p));
  if (isAPI) {
    event.respondWith(
      fetch(request, { cache: 'default' })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell: Cache-First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('/') || caches.match('/index.html');
        }
      });
    })
  );
});

// Background sync for channel updates
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
