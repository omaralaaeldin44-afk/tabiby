// خادم صغير بلا مكتبات خارجية: يقدّم التطبيق + واجهة API للمقابلات.
// - تسجيل دخول الأطباء/الممرضين (scrypt + حد للمحاولات + انتهاء الجلسة).
// - الغرف تُحفظ في الذاكرة فقط وتُحذف بعد 12 ساعة أو عند إنهاء المقابلة (لا قاعدة بيانات).
// - بيانات الأعراض لا تُخزَّن إلا بعد موافقة المريض، ولا يقرؤها إلا موظف مسجّل الدخول.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(here, '../www');
const DATA = path.resolve(here, '../data');
const PORT = +process.env.PORT || 3000;
const ROOM_TTL = 12 * 3600e3, TOKEN_TTL = 30 * 60e3;

/* ---------- الحسابات ---------- */
function loadStaff() {
  const f = path.join(DATA, 'staff.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  console.warn('⚠️  لا يوجد data/staff.json — تم تفعيل حسابات تجريبية. أنشئ حسابات حقيقية بالأمر: npm run add-staff -- <user> <doctor|nurse|interpreter|admin> <password> "<الاسم>"');
  const mk = (u, name, role, pw) => {
    const salt = crypto.randomBytes(16).toString('hex');
    return [u, { name, role, salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') }];
  };
  return Object.fromEntries([
    mk('dr.demo', 'طبيب تجريبي', 'doctor', 'Demo@Doctor1'),
    mk('nurse.demo', 'ممرض تجريبي', 'nurse', 'Demo@Nurse1'),
    mk('interp.demo', 'مترجم إشارة تجريبي', 'interpreter', 'Demo@Interp1'),
    mk('admin.demo', 'مدير المحتوى التجريبي', 'admin', 'Demo@Admin1')
  ]);
}
const STAFF = loadStaff();
const tokens = new Map(); // token -> {user,role,name,exp}
const fails = new Map(); // ip|user -> {n, until}
const rooms = new Map();

/* ---------- أدوات ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon' };
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function headers(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Room-Key, X-Request-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', ...extra
  };
}
function send(res, code, obj) {
  res.writeHead(code, headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }));
  res.end(JSON.stringify(obj));
}
function readBody(req, max = 100e3) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) { reject(Object.assign(new Error('big'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch { reject(Object.assign(new Error('bad'), { code: 400 })); } });
    req.on('error', reject);
  });
}
function staffAuth(req) {
  const m = /^Bearer (\w+)$/.exec(req.headers.authorization || '');
  const t = m && tokens.get(m[1]);
  if (!t || t.exp < Date.now()) return null;
  t.exp = Date.now() + TOKEN_TTL; // تمديد عند النشاط
  return t;
}
const isClinical = t => t && (t.role === 'doctor' || t.role === 'nurse');
const isInterp = t => t && t.role === 'interpreter';
const tokenFromQuery = url => { const t = tokens.get(url.searchParams.get('token') || ''); return t && t.exp > Date.now() ? t : null; };

/* ---------- طلبات المترجم: فيديو شكوى بالإشارة + موعد عيادة مع مترجم ----------
   تُحفظ في data/requests (البيانات الوصفية + ملف الفيديو) وتُحذف تلقائيًا بعد 7 أيام أو عند طلب المريض. */
const REQ_DIR = path.join(DATA, 'requests');
const REQ_FILE = path.join(REQ_DIR, 'requests.json');
const REQ_TTL = 7 * 24 * 3600e3, VIDEO_MAX = 60e6;
fs.mkdirSync(REQ_DIR, { recursive: true });
const requests = new Map(fs.existsSync(REQ_FILE) ? JSON.parse(fs.readFileSync(REQ_FILE, 'utf8')).map(r => [r.id, r]) : []);
let saveTimer;
const saveReqs = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFile(REQ_FILE, JSON.stringify([...requests.values()]), { mode: 0o600 }, () => {}), 200); };
const SYMS = ['الصداع', 'ألم البطن', 'ألم الصدر', 'الدوخة', 'الحرارة', 'الغثيان', 'الحساسية', 'صعوبة التنفس'];
function cleanRequest(b) {
  const base = { firstName: str(b.firstName, 40).trim(), note: str(b.note, 500).trim() };
  if (b.kind === 'complaint') {
    if (b.consent !== true) return null;
    return { kind: 'complaint', ...base, clinic: str(b.clinic, 80).trim(), urgent: b.urgent === true,
      symptoms: (Array.isArray(b.symptoms) ? b.symptoms : []).filter(x => SYMS.includes(x)).slice(0, 8), consent: true };
  }
  if (b.kind === 'appointment') {
    const clinic = str(b.clinic, 80).trim(), date = str(b.date, 10), time = str(b.time, 5);
    if (!clinic || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    return { kind: 'appointment', ...base, clinic, date, time, doctor: str(b.doctor, 60).trim(), phone: str(b.phone, 20).replace(/[^\d+ ]/g, '') };
  }
  return null;
}
const reqView = r => { const { key, video, ...rest } = r; return { ...rest, hasVideo: !!video?.file }; };
function removeReq(r) {
  if (r.video?.file) fs.unlink(path.join(REQ_DIR, r.video.file), () => {});
  requests.delete(r.id); saveReqs();
}

function cleanMsg(who, b) {
  const t = b.type;
  const text = str(b.text, 1000).trim();
  if (who === 'patient') {
    if (t === 'text' && text) return { type: 'text', text };
    if (t === 'answer') { const qid = str(b.qid, 60), answer = str(b.answer, 500).trim(); return qid && answer ? { type: 'answer', qid, answer } : null; }
    if (t === 'help') return { type: 'help' };
  } else {
    if (t === 'text' && text) return { type: 'text', text };
    if (t === 'ack') return { type: 'ack' };
    if (t === 'question' && text) {
      const answerType = ['yesno', 'choices', 'text'].includes(b.answerType) ? b.answerType : 'yesno';
      const choices = (Array.isArray(b.choices) ? b.choices : []).slice(0, 8).map(c => str(c, 40).trim()).filter(Boolean);
      return { type: 'question', text, answerType, choices, signId: str(b.signId, 40) };
    }
  }
  return null;
}
const sev = v => ([0, 1, 2, 3].includes(v) ? v : 0);
function cleanPatient(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    symptoms: (Array.isArray(p.symptoms) ? p.symptoms : []).slice(0, 30).map(s => ({ id: str(s.id, 40), name: str(s.name, 60), severity: sev(s.severity), urgent: ['always', 'severe'].includes(s.urgent) ? s.urgent : null })),
    pains: (Array.isArray(p.pains) ? p.pains : []).slice(0, 20).map(x => ({ part: str(x.part, 20), label: str(x.label, 60), severity: sev(x.severity) }))
  };
}
const view = (r) => ({
  id: r.id, code: r.code, alias: r.alias, shared: r.shared, helpAt: r.helpAt, createdAt: r.createdAt,
  patient: r.shared ? r.patient : null, messages: r.messages
});

/* ---------- API ---------- */
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (m === 'OPTIONS') { res.writeHead(204, headers()); return res.end(); }
  if (p === '/api/health') return send(res, 200, { ok: true, app: 'tabibi-yefhamni' });

  if (p === '/api/login' && m === 'POST') {
    const b = await readBody(req); const u = str(b.username, 60), pw = str(b.password, 200);
    const k = req.socket.remoteAddress + '|' + u, f = fails.get(k);
    if (f && f.until > Date.now()) return send(res, 429, { error: 'locked', message: 'محاولات كثيرة. حاول بعد قليل.' });
    const acc = STAFF[u];
    const hash = acc ? crypto.scryptSync(pw, acc.salt, 32).toString('hex') : crypto.scryptSync(pw, 'x', 32).toString('hex');
    if (!acc || !eq(hash, acc.hash)) {
      const n = (f?.n || 0) + 1; fails.set(k, { n, until: n >= 5 ? Date.now() + 5 * 60e3 : 0 });
      return send(res, 401, { error: 'bad', message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    }
    fails.delete(k);
    const token = crypto.randomBytes(24).toString('hex');
    tokens.set(token, { user: u, role: acc.role, name: acc.name, exp: Date.now() + TOKEN_TTL });
    return send(res, 200, { token, role: acc.role, name: acc.name });
  }

  /* ---- الطلبات ---- */
  if (p === '/api/requests' && m === 'POST') {
    const r = cleanRequest(await readBody(req));
    if (!r) return send(res, 400, { error: 'bad', message: 'بيانات غير مكتملة.' });
    if (requests.size > 2000) return send(res, 503, { error: 'full' });
    const id = crypto.randomBytes(8).toString('hex'), key = crypto.randomBytes(16).toString('hex');
    requests.set(id, { id, key, ...r, createdAt: Date.now(), status: 'new', reply: null, video: null });
    saveReqs();
    return send(res, 200, { id, key });
  }
  if (p === '/api/requests' && m === 'GET') {
    const t = staffAuth(req);
    if (!isInterp(t) && !isClinical(t)) return send(res, 401, { error: 'auth' });
    const list = [...requests.values()].map(reqView).sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || b.createdAt - a.createdAt);
    return send(res, 200, list);
  }
  const rq = /^\/api\/requests\/(\w+)(\/video|\/reply)?$/.exec(p);
  if (rq) {
    const r = requests.get(rq[1]);
    if (!r) return send(res, 404, { error: 'nf' });
    const t = staffAuth(req) || tokenFromQuery(url);
    const owner = eq(req.headers['x-request-key'] || url.searchParams.get('key') || '', r.key);
    const reader = owner || isInterp(t) || isClinical(t);
    const sub = rq[2];
    if (!sub && m === 'GET') return reader ? send(res, 200, reqView(r)) : send(res, 401, { error: 'auth' });
    if (!sub && m === 'DELETE') { if (!owner) return send(res, 403, { error: 'owner only' }); removeReq(r); return send(res, 200, { ok: true }); }
    if (sub === '/reply' && m === 'POST') {
      if (!isInterp(t)) return send(res, 403, { error: 'interpreter only' });
      const b = await readBody(req);
      const status = r.kind === 'appointment' ? (['accepted', 'declined'].includes(b.status) ? b.status : null) : 'done';
      const text = str(b.text, 2000).trim();
      if (!status || (r.kind === 'complaint' && !text)) return send(res, 400, { error: 'bad' });
      r.status = status; r.reply = { text, by: t.name, at: Date.now() }; saveReqs();
      return send(res, 200, reqView(r));
    }
    if (sub === '/video' && m === 'PUT') {
      if (!owner || r.kind !== 'complaint') return send(res, 403, { error: 'owner only' });
      const type = String(req.headers['content-type'] || '').split(';')[0];
      if (!/^video\/(mp4|webm|quicktime|3gpp|x-matroska)$/.test(type)) return send(res, 415, { error: 'type' });
      const ext = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/3gpp': '.3gp', 'video/x-matroska': '.mkv' }[type];
      const file = r.id + ext, tmp = path.join(REQ_DIR, file + '.part');
      let size = 0, failed = false;
      await new Promise(resolve => {
        const out = fs.createWriteStream(tmp, { mode: 0o600 });
        req.on('data', c => { size += c.length; if (size > VIDEO_MAX && !failed) { failed = true; req.unpipe(out); out.destroy(); req.resume(); } });
        req.pipe(out); out.on('finish', resolve); out.on('close', resolve); req.on('error', () => { failed = true; resolve(); });
      });
      if (failed || !size) { fs.unlink(tmp, () => {}); return send(res, failed ? 413 : 400, { error: failed ? 'big' : 'empty' }); }
      fs.renameSync(tmp, path.join(REQ_DIR, file));
      if (r.video?.file && r.video.file !== file) fs.unlink(path.join(REQ_DIR, r.video.file), () => {});
      r.video = { file, type, size }; saveReqs();
      return send(res, 200, { ok: true });
    }
    if (sub === '/video' && m === 'GET') {
      if (!reader || !r.video?.file) return send(res, reader ? 404 : 401, { error: 'nf' });
      const f = path.join(REQ_DIR, r.video.file), st = fs.statSync(f);
      const h = { 'Content-Type': r.video.type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' };
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (range) {
        const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
        if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
        res.writeHead(206, { ...h, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
        return fs.createReadStream(f, { start, end }).pipe(res);
      }
      res.writeHead(200, { ...h, 'Content-Length': st.size });
      return fs.createReadStream(f).pipe(res);
    }
    return send(res, 404, { error: 'nf' });
  }

  if (p === '/api/rooms' && m === 'POST') {
    const b = await readBody(req);
    if (rooms.size > 500) return send(res, 503, { error: 'full' });
    const used = new Set([...rooms.values()].map(r => r.code)); let code;
    do { code = String(1000 + crypto.randomInt(9000)); } while (used.has(code));
    const room = { id: crypto.randomBytes(8).toString('hex'), key: crypto.randomBytes(16).toString('hex'), code, alias: str(b.alias, 30), createdAt: Date.now(), shared: false, patient: null, messages: [], helpAt: null };
    rooms.set(room.id, room);
    return send(res, 200, { id: room.id, code, key: room.key });
  }
  if (p === '/api/rooms' && m === 'GET') {
    if (!isClinical(staffAuth(req))) return send(res, 401, { error: 'auth' });
    return send(res, 200, [...rooms.values()].map(r => ({ id: r.id, code: r.code, alias: r.alias, shared: r.shared, helpAt: r.helpAt, lastAt: r.messages.at(-1)?.t || r.createdAt })));
  }
  if (p === '/api/rooms/by-code' && m === 'POST') {
    if (!isClinical(staffAuth(req))) return send(res, 401, { error: 'auth' });
    const b = await readBody(req); const r = [...rooms.values()].find(x => x.code === str(b.code, 8));
    return r ? send(res, 200, { id: r.id }) : send(res, 404, { error: 'nf' });
  }

  const mm = /^\/api\/rooms\/(\w+)(\/messages|\/share)?$/.exec(p);
  if (mm) {
    const room = rooms.get(mm[1]);
    if (!room) return send(res, 404, { error: 'nf' });
    const staff = staffAuth(req);
    const asPatient = eq(req.headers['x-room-key'] || '', room.key);
    const asStaff = isClinical(staff);
    if (!asPatient && !asStaff) return send(res, 401, { error: 'auth' });
    const sub = mm[2];

    if (!sub && m === 'GET') return send(res, 200, view(room));
    if (!sub && m === 'DELETE') { rooms.delete(room.id); return send(res, 200, { ok: true }); }
    if (sub === '/messages' && m === 'POST') {
      const who = asPatient ? 'patient' : 'staff';
      const msg = cleanMsg(who, await readBody(req));
      if (!msg) return send(res, 400, { error: 'bad' });
      if (room.messages.length >= 300) return send(res, 429, { error: 'full' });
      const out = { id: crypto.randomBytes(5).toString('hex'), t: Date.now(), from: who, ...msg };
      room.messages.push(out);
      if (msg.type === 'help') room.helpAt = out.t;
      if (msg.type === 'ack') room.helpAt = null;
      return send(res, 200, out);
    }
    if (sub === '/share') {
      if (!asPatient) return send(res, 403, { error: 'patient only' });
      if (m === 'POST') {
        const pat = cleanPatient((await readBody(req)).patient);
        if (!pat) return send(res, 400, { error: 'bad' });
        room.shared = true; room.patient = pat; return send(res, 200, { ok: true });
      }
      if (m === 'DELETE') { room.shared = false; room.patient = null; return send(res, 200, { ok: true }); }
    }
  }
  return send(res, 404, { error: 'nf' });
}

/* ---------- الملفات الثابتة ---------- */
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(WWW, rel));
  if (!file.startsWith(WWW + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, headers({ 'Content-Type': 'text/plain; charset=utf-8' })); return res.end('غير موجود'); }
    const ext = path.extname(file).toLowerCase();
    const h = headers({ 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.mp4' ? 'public, max-age=86400' : 'no-cache' });
    delete h['Access-Control-Allow-Headers'];
    if (ext === '.html') h['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'";
    // دعم Range للفيديو
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range && ext === '.mp4') {
      const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : st.size - 1;
      if (start > end || end >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...h, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) send(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: 'error' });
  }
}).listen(PORT, () => console.log(`طبيبي يفهمني يعمل على: http://localhost:${PORT}`));

setInterval(() => {
  const now = Date.now();
  for (const [id, r] of rooms) if (now - r.createdAt > ROOM_TTL) rooms.delete(id);
  for (const [t, v] of tokens) if (v.exp < now) tokens.delete(t);
  for (const [k, v] of fails) if (v.until < now && v.n < 5) fails.delete(k);
  for (const r of [...requests.values()]) if (now - r.createdAt > REQ_TTL) removeReq(r);
}, 60e3).unref();
