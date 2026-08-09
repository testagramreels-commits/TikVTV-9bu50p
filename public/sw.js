/* ============================================================
   TikTV Service Worker — Cache-First for assets, Network-First for API
   SPA deep-link support: navigation requests always return index.html
   ============================================================ */

const CACHE_NAME   = 'tikvtv-v4';
const API_PREFIXES = [
  'iptv-org.github.io/api',
  'iptv-org.github.io/iptv',
  'raw.githubusercontent.com',
  'ui-avatars.com',
];

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

  // Skip non-GET, chrome-extension, and HLS streams
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

  // ── SPA Navigation fallback ──
  // For page navigations (HTML requests), always return the app shell
  // so deep links like /channel/abc don't 404 on refresh.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(cached => {
        if (cached) return cached;
        return fetch('/index.html');
      })
    );
    return;
  }

  // Static assets: Cache-First
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
        if (request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Web Push notification display ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'TikVTV', body: event.data.text() }; }

  const { title = 'TikVTV', body = '', icon = '/manifest.json', url = '/' } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge:  '/manifest.json',
      data:   { url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
