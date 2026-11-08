// Service worker: يجعل التطبيق يعمل دون إنترنت (الشبكة أولًا ثم النسخة المحفوظة).
const V = 'tby-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'icons/icon.svg', 'icons/icon-192.png',
  'js/app.js', 'js/db.js', 'js/rooms.js', 'js/seed.js', 'js/state.js', 'js/ui.js', 'js/staff-demo.js',
  'js/screens-public.js', 'js/screens-patient.js', 'js/screens-staff.js', 'js/screens-admin.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('/videos/')) return; // لا تُخزَّن
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
