// Service Worker for Office Desktop App PWA
const CACHE_NAME = 'ola-alnashi-office-v5';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const urlsToCache = ['./', './index.html'];
      return Promise.allSettled(
        urlsToCache.map((url) => cache.add(url).catch((e) => console.warn('Cache add skipped:', url, e)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Never intercept external services (Firebase, Google APIs, ping endpoints)
  if (!url.startsWith(self.location.origin)) return;

  // NEVER cache or intercept /api/* endpoints, dynamic manifest.json, or PWA app icons
  try {
    const parsed = new URL(url);
    if (
      parsed.pathname.startsWith('/api/') ||
      parsed.pathname === '/manifest.json' ||
      parsed.pathname.endsWith('/manifest.json') ||
      parsed.pathname.includes('pwa-icon') ||
      parsed.pathname.endsWith('/icon.svg')
    ) {
      return;
    }
  } catch {
    if (url.includes('/api/') || url.includes('manifest.json') || url.includes('pwa-icon')) return;
  }
  if (url.includes('version.json') || url.includes('sw-bypass')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return (
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
          );
        }
        return new Response('Network error', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
  );
});
