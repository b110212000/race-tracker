const VERSION = 'race-tracker-v1.4.0';
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;
const ROOT = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.add(ROOT)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;

  // 資料與 HTML 優先網路；網路失敗時才顯示最近成功取得的版本。
  if (url.pathname.includes('/data/') || request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(async () => await caches.match(request) || await caches.match(ROOT) || Response.error()));
    return;
  }

  // CSS/JS/圖示先取網路，以免網站更新後一直停留舊版。
  event.respondWith(fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request)));
});
