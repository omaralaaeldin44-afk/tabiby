// طلبات المترجم: «فيديو شكوى بالإشارة» و«موعد عيادة مع مترجم».
// مع خادم المستشفى تصل للمترجمين. بدونه تُحفظ على هذا الهاتف فقط (ولا تصل لأحد).
import { Net } from './rooms.js';
import { Session, ls } from './state.js';
import { Media, uid } from './db.js';

const MINE = 'tby_myreqs_v1';
export const myRequests = {
  all() { return ls.get(MINE, []); },
  add(r) { const a = this.all().filter(x => x.id !== r.id); a.unshift(r); ls.set(MINE, a.slice(0, 50)); },
  remove(id) { ls.set(MINE, this.all().filter(x => x.id !== id)); },
  clear() { ls.del(MINE); }
};

/* ---------- خادم ---------- */
async function api(path, { method = 'GET', body, key, raw, type } = {}) {
  const headers = {};
  if (!raw) headers['Content-Type'] = 'application/json';
  else headers['Content-Type'] = type;
  const s = Session.get(); if (s?.token && s.token !== 'local') headers.Authorization = 'Bearer ' + s.token;
  if (key) headers['X-Request-Key'] = key;
  const r = await fetch(Net.base + path, { method, headers, body: raw || (body ? JSON.stringify(body) : undefined) });
  if (!r.ok) { const e = new Error('http ' + r.status); e.status = r.status; try { e.data = await r.json(); } catch { /* ignore */ } throw e; }
  return r.json();
}
const Server = {
  async create(data, video) {
    const { id, key } = await api('/api/requests', { method: 'POST', body: data });
    if (video) {
      try { await api(`/api/requests/${id}/video`, { method: 'PUT', key, raw: video, type: (video.type || 'video/webm').split(';')[0] }); }
      catch (e) { await api('/api/requests/' + id, { method: 'DELETE', key }).catch(() => {}); throw e; }
    }
    return { id, key, mode: 'server' };
  },
  get: (id, key) => api('/api/requests/' + id, { key }),
  list: () => api('/api/requests'),
  reply: (id, body) => api(`/api/requests/${id}/reply`, { method: 'POST', body }),
  remove: (id, key) => api('/api/requests/' + id, { method: 'DELETE', key }),
  videoUrl: (r, key) => {
    const s = Session.get();
    const q = key ? 'key=' + encodeURIComponent(key) : 'token=' + encodeURIComponent(s?.token || '');
    return Promise.resolve(`${Net.base}/api/requests/${r.id}/video?${q}`);
  }
};

/* ---------- محلي (هذا الهاتف فقط) ---------- */
const LS = 'tby_requests_v1';
const rd = () => ls.get(LS, {});
const wr = o => { if (!ls.set(LS, o)) throw new Error('تعذّر الحفظ على الهاتف'); };
const Local = {
  async create(data, video) {
    const id = uid('q'); const o = rd();
    o[id] = { id, ...data, createdAt: Date.now(), status: 'new', reply: null, hasVideo: !!video, local: true };
    if (video) await Media.put('rv:' + id, video);
    wr(o); return { id, key: 'local', mode: 'local' };
  },
  async get(id) { const r = rd()[id]; if (!r) throw Object.assign(new Error('nf'), { status: 404 }); return r; },
  async list() { return Object.values(rd()).sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || b.createdAt - a.createdAt); },
  async reply(id, { text, status }) {
    const o = rd(); const r = o[id]; if (!r) throw new Error('nf');
    r.status = r.kind === 'appointment' ? status : 'done'; r.reply = { text, by: Session.get()?.name || '', at: Date.now() };
    wr(o); return r;
  },
  async remove(id) { const o = rd(); delete o[id]; wr(o); await Media.del('rv:' + id); return { ok: true }; },
  videoUrl: r => Media.url('rv:' + r.id)
};

const impl = mode => ((mode || Net.mode) === 'server' ? Server : Local);
export const Requests = {
  create: (data, video) => impl().create(data, video),
  get: (ref) => impl(ref.mode).get(ref.id, ref.key),
  list: () => impl().list(),
  reply: (id, body) => impl().reply(id, body),
  remove: (ref) => impl(ref.mode).remove(ref.id, ref.key),
  videoUrl: (r, ref) => impl(ref?.mode).videoUrl(r, ref?.key)
};

export const STATUS = {
  new: ['بانتظار المترجم', 'info'], done: ['تم الرد', 'ok'], accepted: ['تم تجهيز مترجم', 'ok'], declined: ['تعذّر توفير مترجم', 'no']
};
