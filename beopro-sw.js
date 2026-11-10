/* BeoPro service worker — scope is this folder only (/beopro/) */
const CACHE = 'beopro-v1';
const BASE = new URL('./', self.location).href;           // e.g. https://easylandx.github.io/beopro/
const abs = (p) => new URL(p, BASE).href;
const CORE = [
  './', 'index.html', 'beopro.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'apple-touch-icon.png', 'favicon-32.png'
].map(abs);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.indexOf('beopro-') === 0 && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only our own folder. archive.org audio/metadata, translation API etc. go straight to the network.
  if (url.origin !== self.location.origin || url.href.indexOf(BASE) !== 0) return;

  // HTML: network first so updates show up fast, cached copy when offline.
  // (?a=...&n=... share links are the same page, so they all map to one cached entry.)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(BASE, copy));
          }
          return res;
        })
        .catch(() => caches.match(BASE).then((r) => r || caches.match(abs('index.html'))))
    );
    return;
  }

  // Icons / manifest: cache first, refreshed in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
