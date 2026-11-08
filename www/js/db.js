// المحتوى (localStorage) + الوسائط المحلية (IndexedDB) + تحديد مصدر الفيديو.
import { seedContent } from './seed.js';
import { ls } from './state.js';

const KEY = 'tby_content_v1';
let cache = null;
export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
export const byId = (list, id) => list.find(x => x.id === id);

export function content() {
  if (!cache) {
    const saved = ls.get(KEY, null);
    cache = saved && saved.signs ? saved : seedContent();
  }
  return cache;
}
export function saveContent() { return ls.set(KEY, content()); }
export function resetContent() { cache = seedContent(); saveContent(); }
export function replaceContent(obj) {
  if (!obj || !Array.isArray(obj.signs) || !Array.isArray(obj.questions) || !Array.isArray(obj.categories) || !Array.isArray(obj.symptoms))
    throw new Error('الملف ليس ملف محتوى صحيحًا');
  cache = obj; saveContent();
}

/* ---------- IndexedDB للوسائط ---------- */
let dbp;
const open = () => (dbp ??= new Promise((res, rej) => {
  if (!('indexedDB' in window)) return rej(new Error('IndexedDB غير مدعوم'));
  const r = indexedDB.open('tby-media', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('blobs');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('blobs', mode);
    const rq = fn(t.objectStore('blobs'));
    t.oncomplete = () => res(rq?.result);
    t.onerror = () => rej(t.error);
  });
};

export const Media = {
  keys: new Set(),
  urls: new Map(),
  async init() {
    try {
      const keys = await tx('readonly', s => s.getAllKeys());
      this.keys = new Set(keys);
      for (const k of keys) if (String(k).startsWith('img:')) await this.url(k);
    } catch { /* وضع خاص أو غير مدعوم */ }
  },
  async url(key) {
    if (this.urls.has(key)) return this.urls.get(key);
    const blob = await tx('readonly', s => s.get(key));
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    this.urls.set(key, u);
    return u;
  },
  async put(key, blob) {
    await tx('readwrite', s => s.put(blob, key));
    this.keys.add(key);
    if (this.urls.has(key)) { URL.revokeObjectURL(this.urls.get(key)); this.urls.delete(key); }
    await this.url(key);
  },
  async del(key) {
    try { await tx('readwrite', s => s.delete(key)); } catch { /* ignore */ }
    this.keys.delete(key);
    if (this.urls.has(key)) { URL.revokeObjectURL(this.urls.get(key)); this.urls.delete(key); }
  },
  hasVideo(id) { return this.keys.has('v:' + id); }
};

/* ---------- مصدر الفيديو ---------- */
const probeCache = new Map();
async function probe(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    return r.ok && (ct.startsWith('video/') || ct === 'application/octet-stream');
  } catch { return false; }
}
export function clearProbe() { probeCache.clear(); }

/** يعيد {src, kind:'local'|'remote'} أو null إذا لم يتوفر فيديو فعليًا. */
export async function videoSource(sign) {
  if (!sign) return null;
  if (Media.hasVideo(sign.id)) {
    const u = await Media.url('v:' + sign.id);
    if (u) return { src: u, kind: 'local' };
  }
  const url = sign.url || sign.file;
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return { src: url, kind: 'remote' }; // رابط خارجي: يتحقق المشغّل عند التحميل
  if (!probeCache.has(url)) probeCache.set(url, probe(url));
  return (await probeCache.get(url)) ? { src: url, kind: 'remote' } : null;
}

/** حفظ كل فيديو متاح على الهاتف تلقائيًا (مرة واحدة) حتى يعمل لاحقًا دون إنترنت. */
let autoRunning = false;
export async function autoSaveVideos() {
  if (autoRunning || !navigator.onLine) return; autoRunning = true;
  try {
    for (const s of content().signs) {
      if (Media.hasVideo(s.id)) continue;
      const src = await videoSource(s);
      if (src?.kind === 'remote' && !/^https?:/i.test(src.src)) { try { await downloadVideo(s); } catch { /* حاول لاحقًا */ } }
    }
  } finally { autoRunning = false; }
}

/** تنزيل فيديو متاح ليُحفظ على الهاتف للعمل دون إنترنت. */
export async function downloadVideo(sign) {
  const src = await videoSource(sign);
  if (!src) throw new Error('الفيديو غير متوفر');
  if (src.kind === 'local') return 'local';
  const r = await fetch(src.src);
  if (!r.ok) throw new Error('تعذّر تنزيل الفيديو');
  await Media.put('v:' + sign.id, await r.blob());
  return 'done';
}
