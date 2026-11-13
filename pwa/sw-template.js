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
    // Fresh page from the network when it answers quickly, else the cached one (offline)
    event.respondWith(
      (async () => {
        const cached = await caches.match('/index.html', { cacheName: PRECACHE, ignoreVary: true });
        if (!cached) return fetch(req);
        const network = fetch(req, { cache: 'no-store' })
          .then((r) => (r && r.ok ? r : cached))
          .catch(() => cached);
        const timeout = new Promise((res) => setTimeout(() => res(cached), 3000));
        return Promise.race([network, timeout]);
      })()
    );
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

// Low stock alerts sent from the server, shown even when the app is closed
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Stock alert', {
      body: data.body || '',
      tag: data.tag || 'stock-alert',
      renotify: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin)) {
          if ('navigate' in w) w.navigate(target).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// The browser replaced this phone's push registration: register the new one
self.addEventListener('pushsubscriptionchange', (event) => {
  const SUPABASE = 'https://bpbhnnnrjckcqjvgogsu.supabase.co';
  const KEY = 'sb_publishable_XIftpJPy3WCXwLDXd81m2A_CeTjKrYE';
  const rpc = (fn, body) =>
    fetch(`${SUPABASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      let sub = event.newSubscription;
      if (!sub && old && old.options) sub = await self.registration.pushManager.subscribe(old.options);
      if (!sub) return;
      await rpc('subscribe_push', { sub: sub.toJSON(), person: '', device: 'Updated registration' });
      if (old && old.endpoint !== sub.endpoint) await rpc('unsubscribe_push', { endpoint_url: old.endpoint });
    })().catch(() => {})
  );
});
