/* Bahubali Stock service worker — generated at build time. Do not edit dist/sw.js. */
const VERSION = '__VERSION__';
const PRECACHE = `bahubali-precache-${VERSION}`;
const RUNTIME = 'bahubali-runtime-images';
const PRECACHE_URLS = __PRECACHE_URLS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('bahubali-precache-') && k !== PRECACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App pages: always answer from the cached app shell (works with no network)
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(caches.match('/index.html', { cacheName: PRECACHE, ignoreVary: true }).then((r) => r || fetch(req)));
    return;
  }

  // Built app files: cache first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req))
    );
    return;
  }

  // External images (demo product photos): keep a copy once seen
  if (req.destination === 'image') {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const cached = await cache.match(req, { ignoreVary: true });
        const network = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
