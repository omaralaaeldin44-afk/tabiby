// Service worker: يجعل التطبيق يعمل دون إنترنت (الشبكة أولًا ثم النسخة المحفوظة).
const V = 'tby-v5';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'icons/icon.svg', 'icons/icon-192.png',
  'js/app.js', 'js/db.js', 'js/rooms.js', 'js/seed.js', 'js/state.js', 'js/ui.js', 'js/staff-demo.js',
  'js/screens-public.js', 'js/screens-patient.js', 'js/screens-staff.js', 'js/screens-admin.js',
  'js/direct.js', 'js/vendor/qrcode.js', 'js/vendor/jsQR.js', 'js/icons.js', 'js/requests.js', 'js/screens-extra.js',
  'fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2', 'fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2',
  'img/pics/adhesive-bandage.svg', 'img/pics/ambulance.svg', 'img/pics/anatomical-heart.svg', 'img/pics/bell.svg', 'img/pics/brain.svg', 'img/pics/bust-in-silhouette.svg', 'img/pics/check-mark-button.svg', 'img/pics/cross-mark-button.svg', 'img/pics/cup-with-straw.svg', 'img/pics/droplet.svg', 'img/pics/e-mail.svg', 'img/pics/eyes.svg', 'img/pics/face-vomiting.svg', 'img/pics/face-with-head-bandage.svg', 'img/pics/face-with-spiral-eyes.svg', 'img/pics/face-with-thermometer.svg', 'img/pics/folded-hands.svg', 'img/pics/framed-picture.svg', 'img/pics/gear.svg', 'img/pics/handshake.svg', 'img/pics/health-worker.svg', 'img/pics/hospital.svg', 'img/pics/leg.svg', 'img/pics/light-bulb.svg', 'img/pics/link.svg', 'img/pics/loudspeaker.svg', 'img/pics/lungs.svg', 'img/pics/megaphone.svg', 'img/pics/memo.svg', 'img/pics/mobile-phone.svg', 'img/pics/nauseated-face.svg', 'img/pics/open-book.svg', 'img/pics/persevering-face.svg', 'img/pics/person-deaf.svg', 'img/pics/person-raising-hand.svg', 'img/pics/pill.svg', 'img/pics/red-question-mark.svg', 'img/pics/round-pushpin.svg', 'img/pics/slightly-smiling-face.svg', 'img/pics/sneezing-face.svg', 'img/pics/sos-button.svg', 'img/pics/speech-balloon.svg', 'img/pics/spiral-calendar.svg', 'img/pics/stethoscope.svg', 'img/pics/syringe.svg', 'img/pics/thermometer.svg', 'img/pics/thinking-face.svg', 'img/pics/tired-face.svg', 'img/pics/toilet.svg', 'img/pics/video-camera.svg', 'img/pics/warning.svg', 'img/pics/waving-hand.svg', 'img/pics/worried-face.svg', 'img/pics/writing-hand.svg'];

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
