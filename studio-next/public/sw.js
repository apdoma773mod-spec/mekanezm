// عامل الأوفلاين للستوديو (Next.js). قبل كده كان بيخزّن كل طلب للأبد (صور، بيانات، فيديو) فالتخزين بيكبر والآيفون يتقل.
// دلوقتي: ملفات Next الثابتة (_next/static) والأيقونات بس بتتخزن، الصفحة بتيجي من النت الأول (ولو مفيش نت من آخر نسخة)،
// وأي طلب بيانات (/api/…) مابيتلمسش. التفعيل بيمسح كل الكاش القديم.
const V = 'mkz-next-v11';
const CORE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // ملفات Next الثابتة: اسمها بيتغير مع كل نشر، فالكاش آمن
  if (u.pathname.startsWith('/_next/static/') || /\.(png|ico|webmanifest|woff2?)$/.test(u.pathname)) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); } return res; })));
    return;
  }
  // الصفحة نفسها: من النت الأول، ولو النت فاصل من آخر نسخة
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put('/', c)); } return res; }).catch(() => caches.match('/')));
  }
});
