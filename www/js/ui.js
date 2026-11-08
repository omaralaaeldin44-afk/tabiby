// عناصر الواجهة المشتركة.
import { Media, videoSource, downloadVideo } from './db.js';

export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
};

// replaceChildren الأصلية لا تتجاهل null/false ولا تفرد المصفوفات؛ نجعلها تتصرف مثل h().
const nativeReplace = Element.prototype.replaceChildren;
Element.prototype.replaceChildren = function (...kids) {
  nativeReplace.apply(this, kids.flat(Infinity).filter(k => k != null && k !== false).map(k => (k.nodeType ? k : document.createTextNode(k))));
};

export const go = path => { location.hash = '#' + path; };

export function toast(msg, type = 'info', ms = 4500) {
  const t = h('div', { class: 'toast ' + type, role: type === 'error' ? 'alert' : 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

export function modal({ title, body, actions = [], wide = false, onClose }) {
  const prev = document.activeElement;
  const ov = h('div', { class: 'overlay' });
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'نافذة' },
    title && h('h2', {}, title),
    h('div', { class: 'modal-body' }, body),
    actions.length > 0 && h('div', { class: 'modal-actions' }, actions.map(a =>
      h('button', { class: 'btn ' + (a.cls || 'secondary'), type: 'button', onclick: async () => { if ((await a.onclick?.()) === false) return; close(); } }, a.label))));
  ov.append(box);
  function close() { ov.remove(); document.removeEventListener('keydown', esc); prev?.focus?.(); onClose?.(); }
  function esc(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', esc);
  document.getElementById('modal-root').append(ov);
  (box.querySelector('input,textarea,select,.btn') || box).focus?.();
  return { close, box };
}

export function confirmBox(message, okLabel = 'نعم، متأكد', cls = 'danger') {
  return new Promise(res => {
    let done = false;
    modal({
      title: 'تأكيد', body: h('p', { class: 'lead' }, message),
      actions: [{ label: okLabel, cls, onclick: () => { done = true; res(true); } }, { label: 'إلغاء' }],
      onClose: () => { if (!done) res(false); }
    });
  });
}

/* ---------- جسم الإنسان (SVG) ---------- */
const REG = {
  head: '<circle cx="100" cy="40" r="28"/>',
  neck: '<rect x="88" y="66" width="24" height="16" rx="6"/>',
  chest: '<rect x="60" y="84" width="80" height="66" rx="16"/>',
  abdomen: '<rect x="64" y="152" width="72" height="60" rx="16"/>',
  armR: '<rect x="28" y="86" width="26" height="136" rx="13"/>',
  armL: '<rect x="146" y="86" width="26" height="136" rx="13"/>',
  legR: '<rect x="66" y="216" width="32" height="170" rx="15"/>',
  legL: '<rect x="102" y="216" width="32" height="170" rx="15"/>'
};
export function bodySVG({ active = [], interactive = false, label = 'جسم الإنسان' } = {}) {
  const parts = Object.entries(REG).map(([k, shape]) => {
    const on = active.includes(k);
    return shape.replace('/>', ` class="part${on ? ' on' : ''}"${interactive ? ` data-part="${k}"` : ''}/>`);
  }).join('');
  return `<svg viewBox="0 0 200 400" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${parts}</svg>`;
}

/** أيقونة عنصر: إيموجي، أو body:<جزء>، أو صورة محفوظة img:<id>. */
export function iconEl(icon, cls = '') {
  icon = icon || '❔';
  if (icon.startsWith('body:')) return h('span', { class: 'icon body-icon ' + cls, 'aria-hidden': 'true', html: bodySVG({ active: [icon.slice(5)] }) });
  if (icon.startsWith('img:')) {
    const u = Media.urls.get(icon);
    if (u) return h('img', { class: 'icon img-icon ' + cls, src: u, alt: '', 'aria-hidden': 'true' });
  }
  return h('span', { class: 'icon ' + cls, 'aria-hidden': 'true' }, icon.startsWith('img:') ? '🖼️' : icon);
}

export const badge = (text, kind = 'info') => h('span', { class: 'badge ' + kind }, text);

/** شارة حالة الفيديو (تُحدَّث بعد التحقق). */
export function videoBadge(sign) {
  const b = badge('جارٍ التحقق…', 'info');
  videoSource(sign).then(s => {
    b.className = 'badge ' + (s ? 'ok' : 'no');
    b.textContent = s ? (s.kind === 'local' ? '✓ متوفر (محفوظ على الهاتف)' : '✓ متوفر') : 'غير متوفر';
  });
  return b;
}

/* ---------- مشغّل فيديو لغة الإشارة ---------- */
export function videoPlayer(sign) {
  const stage = h('div', { class: 'vp-stage' }, h('p', { class: 'vp-msg' }, 'جارٍ التحقق من الفيديو…'));
  const controls = h('div', { class: 'vp-controls' });
  const wrap = h('div', { class: 'vp' }, stage, controls, h('p', { class: 'vp-cap', dir: 'auto' }, sign.text));

  const missing = () => {
    stage.className = 'vp-stage missing';
    stage.replaceChildren(h('div', { class: 'vp-missing' },
      h('div', { class: 'big', 'aria-hidden': 'true' }, '🎬'),
      h('strong', {}, 'الفيديو غير متوفر حاليًا'),
      h('span', {}, 'اقرأ النص المكتوب أدناه. يمكن إضافة الفيديو لاحقًا من لوحة إدارة المحتوى.')));
    controls.replaceChildren();
  };

  videoSource(sign).then(src => {
    if (!src) return missing();
    stage.replaceChildren();
    const v = h('video', { playsinline: true, preload: 'metadata', src: src.src, 'aria-label': 'فيديو لغة الإشارة المصرية: ' + sign.text });
    v.muted = true; // لا اعتماد على الصوت
    const prog = h('progress', { max: '1', value: '0', 'aria-label': 'تقدم الفيديو' });
    const play = h('button', { class: 'btn primary', type: 'button' }, '▶ تشغيل');
    const replay = h('button', { class: 'btn secondary', type: 'button' }, '↻ إعادة');
    const slow = h('button', { class: 'btn ghost', type: 'button', 'aria-pressed': 'false' }, '🐢 أبطأ');
    play.onclick = () => (v.paused ? v.play() : v.pause());
    replay.onclick = () => { v.currentTime = 0; v.play(); };
    slow.onclick = () => { const on = v.playbackRate !== 0.5; v.playbackRate = on ? 0.5 : 1; slow.setAttribute('aria-pressed', on); slow.textContent = on ? '🐇 عادي' : '🐢 أبطأ'; };
    v.onplay = () => (play.textContent = '⏸ إيقاف');
    v.onpause = () => (play.textContent = v.ended ? '▶ شاهد مرة أخرى' : '▶ تشغيل');
    v.onended = () => (play.textContent = '▶ شاهد مرة أخرى');
    v.ontimeupdate = () => { prog.value = v.duration ? v.currentTime / v.duration : 0; };
    v.onerror = missing;
    stage.append(v);
    controls.append(play, replay, slow, prog);
    if (src.kind === 'remote' && !/^https?:/i.test(src.src)) {
      const dl = h('button', { class: 'btn ghost', type: 'button' }, '⬇ حفظ للعمل دون إنترنت');
      dl.onclick = async () => {
        dl.disabled = true;
        try { await downloadVideo(sign); dl.replaceWith(badge('✓ تم الحفظ على هذا الهاتف', 'ok')); }
        catch (e) { dl.disabled = false; toast(e.message || 'تعذّر الحفظ', 'error'); }
      };
      controls.append(dl);
    }
  });
  return wrap;
}

/** عرض نص كبير ملء الشاشة (للإظهار لشخص آخر) مع الفيديو إن وجد. */
export function showBig({ text, sign, danger = false }) {
  const body = h('div', { class: 'big-show' + (danger ? ' danger' : '') },
    h('p', { class: 'big-text', dir: 'auto' }, text), sign && videoPlayer(sign));
  return modal({ body, actions: [{ label: 'إغلاق', cls: 'primary' }], wide: true });
}
