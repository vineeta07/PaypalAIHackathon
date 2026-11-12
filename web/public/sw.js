// FairLoop service worker: offline app shell. API calls always go to the network
// (money data is never served from cache); pages fall back to the cached shell offline.
const VERSION = 'fairloop-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // live data only

  if (req.mode === 'navigate') {
    // Network first so the app is always fresh; cached shell when offline.
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return res; }).catch(() => caches.match('/')));
    return;
  }
  // Static assets (hashed by Vite): stale-while-revalidate.
  event.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || network;
  }));
});
