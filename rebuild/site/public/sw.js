// ميكانيزم service worker: app shell + photos cached for fast repeat visits; pages work offline
// with the last version seen. Bump VERSION to drop old caches.
const VERSION = 'mk-v1';
const PAGES = VERSION + '-pages', ASSETS = VERSION + '-assets', IMGS = VERSION + '-imgs';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(PAGES).then(c => c.addAll(['/'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const trim = async (name, max) => {
  const c = await caches.open(name), ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
};

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  // Next build files never change under the same name: cache first.
  if (u.origin === location.origin && u.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { const cp = res.clone(); caches.open(ASSETS).then(c => c.put(r, cp)); return res; })));
    return;
  }
  // Product photos (Supabase image CDN + local covers): cache first, keep the last 300.
  if (r.destination === 'image' && (/supabase\.co$/.test(u.hostname) || u.origin === location.origin)) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(IMGS).then(c => c.put(r, cp)).then(() => trim(IMGS, 300)); }
      return res;
    })));
    return;
  }
  // Pages: network first, fall back to the cached copy when offline.
  if (r.mode === 'navigate' && u.origin === location.origin && !u.pathname.startsWith('/api/')) {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(PAGES).then(c => c.put(r, cp)).then(() => trim(PAGES, 60)); return res; })
      .catch(() => caches.match(r).then(hit => hit || caches.match('/'))));
  }
});
