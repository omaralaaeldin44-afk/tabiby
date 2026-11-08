// نقطة البدء: التوجيه، الهيكل العام، زر المساعدة، تسجيل الخروج التلقائي.
import { h, go, toast, modal } from './ui.js';
import { Media, content, autoSaveVideos } from './db.js';
import { Rooms, Net, detectServer, subscribe } from './rooms.js';
import { Patient, Session, urgentReason } from './state.js';
import * as pub from './screens-public.js';
import * as pat from './screens-patient.js';
import * as stf from './screens-staff.js';
import { admin } from './screens-admin.js';
import { Direct } from './direct.js';

const routes = [
  ['/', pub.home], ['/howto', pub.howto], ['/help', pub.help], ['/signs', pub.signsHome], ['/signs/:id', pub.signsCategory],
  ['/sign/:id', pub.signPage], ['/settings', pub.settings],
  ['/patient', pat.patientHub], ['/symptoms', pat.symptomsPage], ['/pain', pat.painPage], ['/visit', pat.visit],
  ['/login/:role', stf.login], ['/login/:role/:room', stf.login],
  ['/staff', stf.staffDash, 'staff'], ['/room/:id', stf.staffRoom, 'staff'],
  ['/admin', admin, 'admin'], ['/admin/:tab', admin, 'admin']
];

function match(path) {
  const segs = path.split('/').filter(Boolean);
  for (const [pattern, fn, guard] of routes) {
    const ps = pattern.split('/').filter(Boolean);
    if (ps.length !== segs.length) continue;
    const params = {};
    if (ps.every((p, i) => (p.startsWith(':') ? (params[p.slice(1)] = decodeURIComponent(segs[i]), true) : p === segs[i]))) return { fn, params, guard };
  }
  return null;
}

const app = {
  cleanup: null,
  refreshNet() { render(); },
  async helpNow() { await helpNow(); }
};

/* ---------- زر «أحتاج مساعدة الآن» ---------- */
async function helpNow() {
  let delivered = false, roomId = null; const t0 = Date.now();
  try {
    if (Net.mode === 'server') {
      if (!Patient.s.roomId) { const r = await Rooms.create(''); Object.assign(Patient.s, { roomId: r.id, roomKey: r.key, roomCode: r.code }); Patient.save(); }
      await Rooms.post(Patient.s.roomId, 'patient', { type: 'help' }); delivered = true; roomId = Patient.s.roomId;
    } else if (Patient.s.roomId) {
      await Rooms.post(Patient.s.roomId, 'patient', { type: 'help' });
      // في الربط المباشر يُرسل هاتف المريض نسخة المقابلة فورًا إلى هاتف الطبيب.
      if (Direct.patientConnected()) { delivered = true; roomId = Patient.s.roomId; }
    }
  } catch { delivered = false; }
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  const urgent = urgentReason(content());
  const ack = h('p', { class: 'big-status' });
  const status = h('p', { class: 'big-status' }, delivered
    ? '✅ تم إرسال تنبيه إلى شاشة الطبيب/الممرض. ابقَ في مكانك وارفع هذه الشاشة.'
    : '⚠️ لم يُرسل أي تنبيه، لأن هذا الهاتف غير مرتبط بهاتف الطبيب ولا بنظام المستشفى. أرِ هذه الشاشة الآن لأقرب طبيب أو ممرض.');
  let unsub;
  modal({
    wide: true, onClose: () => unsub?.(),
    body: h('div', { class: 'big-show danger flash', role: 'alert' },
      h('p', { class: 'big-text' }, '🆘 أحتاج حضور الطبيب أو الممرض الآن'),
      urgent && h('p', { class: 'big-status' }, `اخترتُ: ${urgent} — أحتاج مساعدة طبية فورًا.`), status, ack),
    actions: [{ label: 'إغلاق', cls: 'primary' }]
  });
  if (delivered && roomId) {
    unsub = subscribe(() => Rooms.get(roomId, 'patient'), room => {
      if (room?.messages.some(m => m.type === 'ack' && m.t >= t0)) ack.textContent = '✅ تم استلام طلبك. الطبيب/الممرض في الطريق إليك.';
    });
  }
}

/* ---------- الهيكل ---------- */
const header = document.getElementById('hdr');
const main = document.getElementById('main');
const fab = document.getElementById('fab');
const offline = document.getElementById('offline');

function render() {
  app.cleanup?.(); app.cleanup = null;
  const path = (location.hash.slice(1) || '/').split('?')[0];
  const m = match(path);
  let screen;
  if (!m) screen = pub.notFound();
  else if (m.guard === 'staff' && !stf.staffSession()) { toast('سجّل الدخول أولًا للوصول إلى بيانات المرضى.', 'error'); return go('/login/staff' + (path.startsWith('/room/') ? '/' + m.params.id : '')); }
  else if (m.guard === 'admin' && !stf.adminSession()) { toast('سجّل الدخول أولًا للوصول إلى لوحة الإدارة.', 'error'); return go('/login/admin'); }
  else {
    try { screen = m.fn(m.params, app); }
    catch (e) { console.error(e); screen = { title: 'خطأ', el: h('div', { class: 'alert urgent' }, 'حدث خطأ غير متوقع. ارجع إلى الرئيسية وحاول مرة أخرى.') }; }
  }
  app.cleanup = screen.cleanup || null;
  header.replaceChildren(
    screen.home ? h('span', { class: 'hdr-spacer' }) : h('a', { class: 'hdr-btn', href: '#' + (screen.back || '/'), onclick: e => { e.preventDefault(); if (screen.back) go(screen.back); else history.length > 1 ? history.back() : go('/'); } }, '→ رجوع'),
    h('h1', { class: 'hdr-title' }, screen.title),
    h('a', { class: 'hdr-btn', href: '#/', 'aria-label': 'الرئيسية' }, '🏠'));
  main.replaceChildren(screen.el);
  fab.hidden = !!screen.noFab;
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

fab.addEventListener('click', helpNow);
window.addEventListener('hashchange', render);
const updateOffline = () => { offline.hidden = navigator.onLine; };
window.addEventListener('online', updateOffline); window.addEventListener('offline', updateOffline); updateOffline();

/* خروج تلقائي للموظفين بعد 15 دقيقة دون نشاط */
let idle;
const bump = () => {
  clearTimeout(idle);
  if (Session.get()) idle = setTimeout(() => { stf.staffLogout(); toast('تم تسجيل خروجك تلقائيًا لحماية بيانات المرضى.', 'info', 8000); go('/'); }, 15 * 60e3);
};
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, bump, { passive: true }));

(async () => {
  await Media.init();
  await detectServer();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  bump(); render();
  setTimeout(() => autoSaveVideos().catch(() => {}), 4000);
})();
