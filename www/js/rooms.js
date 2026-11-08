// قناة المقابلة بين المريض والطبيب/الممرض.
// الوضع "server": خادم المستشفى (مصادقة حقيقية). الوضع "local": هذا الهاتف/المتصفح فقط (تجريبي).
import { Settings, Patient, Session } from './state.js';
import { uid } from './db.js';

export const Net = { mode: 'local', base: '' };

export async function detectServer() {
  const cands = [];
  const custom = Settings.serverUrl.trim().replace(/\/+$/, '');
  if (custom) cands.push(custom);
  if (/^https?:$/.test(location.protocol)) cands.push('');
  for (const base of cands) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 2500);
      const r = await fetch(base + '/api/health', { signal: c.signal, cache: 'no-store' });
      clearTimeout(t);
      if (r.ok && (await r.json()).app === 'tabibi-yefhamni') { Net.mode = 'server'; Net.base = base; return Net; }
    } catch { /* جرّب التالي */ }
  }
  Net.mode = 'local'; Net.base = '';
  return Net;
}

/* ---------- خادم ---------- */
async function api(path, { method = 'GET', body, who } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (who === 'staff') { const s = Session.get(); if (s?.token) headers.Authorization = 'Bearer ' + s.token; }
  if (who === 'patient') headers['X-Room-Key'] = Patient.s.roomKey || '';
  const r = await fetch(Net.base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    const e = new Error('http ' + r.status); e.status = r.status;
    try { e.data = await r.json(); } catch { /* ignore */ }
    throw e;
  }
  return r.json();
}
export async function serverLogin(username, password) {
  return api('/api/login', { method: 'POST', body: { username, password } });
}
const Server = {
  create: (alias) => api('/api/rooms', { method: 'POST', body: { alias } }),
  get: (id, who) => api('/api/rooms/' + id, { who }),
  list: () => api('/api/rooms', { who: 'staff' }),
  byCode: (code) => api('/api/rooms/by-code', { method: 'POST', body: { code }, who: 'staff' }),
  post: (id, who, msg) => api('/api/rooms/' + id + '/messages', { method: 'POST', body: msg, who }),
  share: (id, patient) => api('/api/rooms/' + id + '/share', { method: 'POST', body: { patient }, who: 'patient' }),
  unshare: (id) => api('/api/rooms/' + id + '/share', { method: 'DELETE', who: 'patient' }),
  remove: (id, who) => api('/api/rooms/' + id, { method: 'DELETE', who })
};

/* ---------- محلي (نفس الجهاز) ---------- */
const LS = 'tby_rooms_v1';
const rd = () => {
  try {
    const o = JSON.parse(localStorage.getItem(LS) || '{}'); const now = Date.now();
    for (const k in o) if (now - o[k].createdAt > 12 * 36e5) delete o[k];
    return o;
  } catch { return {}; }
};
const wr = o => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch { throw new Error('تعذّر الحفظ على الهاتف'); } };
const nf = () => Object.assign(new Error('not found'), { status: 404 });
const Local = {
  async create(alias) {
    const o = rd(); const used = new Set(Object.values(o).map(r => r.code)); let code;
    do { code = String(1000 + Math.floor(Math.random() * 9000)); } while (used.has(code));
    const id = uid('r');
    o[id] = { id, code, alias: (alias || '').slice(0, 30), createdAt: Date.now(), shared: false, patient: null, messages: [], helpAt: null };
    wr(o); return { id, code, key: 'local' };
  },
  async get(id) { const r = rd()[id]; if (!r) throw nf(); return r; },
  async list() {
    return Object.values(rd()).map(r => ({ id: r.id, code: r.code, alias: r.alias, shared: r.shared, helpAt: r.helpAt, lastAt: r.messages.at(-1)?.t || r.createdAt }));
  },
  async byCode(code) { const r = Object.values(rd()).find(x => x.code === String(code)); if (!r) throw nf(); return { id: r.id }; },
  async post(id, who, msg) {
    const o = rd(); const r = o[id]; if (!r) throw nf();
    const m = { id: uid('m'), t: Date.now(), from: who, ...msg };
    r.messages.push(m);
    if (m.type === 'help') r.helpAt = m.t;
    if (m.type === 'ack') r.helpAt = null;
    wr(o); return m;
  },
  async share(id, patient) { const o = rd(); if (!o[id]) throw nf(); o[id].shared = true; o[id].patient = patient; wr(o); return { ok: true }; },
  async unshare(id) { const o = rd(); if (!o[id]) throw nf(); o[id].shared = false; o[id].patient = null; wr(o); return { ok: true }; },
  async remove(id) { const o = rd(); delete o[id]; wr(o); return { ok: true }; }
};

const impl = () => (Net.mode === 'server' ? Server : Local);
export const Rooms = {
  create: a => impl().create(a), get: (id, who) => impl().get(id, who), list: () => impl().list(),
  byCode: c => impl().byCode(c), post: (id, who, m) => impl().post(id, who, m),
  share: (id, p) => impl().share(id, p), unshare: id => impl().unshare(id), remove: (id, who) => impl().remove(id, who)
};

/** استطلاع دوري؛ يستدعي cb(data) عند تغيّر البيانات و cb(null, err) عند حدوث خطأ جديد. */
export function subscribe(fn, cb, ms = 1500) {
  let last = '', stopped = false, busy = false, hadErr = false;
  const tick = async () => {
    if (stopped || busy) return; busy = true;
    try {
      const d = await fn(); hadErr = false;
      const s = JSON.stringify(d);
      if (s !== last) { last = s; cb(d); }
    } catch (e) { if (!hadErr) { hadErr = true; cb(null, e); } }
    busy = false;
  };
  tick();
  const iv = setInterval(tick, ms);
  window.addEventListener('storage', tick);
  return () => { stopped = true; clearInterval(iv); window.removeEventListener('storage', tick); };
}
