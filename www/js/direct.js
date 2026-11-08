// الربط المباشر بين هاتف المريض وهاتف الطبيب (WebRTC) دون خادم ودون إنترنت.
// يكفي أن يكون الهاتفان على نفس شبكة الواي فاي، أو أن يفتح أحدهما «نقطة اتصال» ويتصل بها الآخر.
// التبادل الأولي يتم بمسح رمزي QR (رمز من المريض ثم رمز من الطبيب). هاتف المريض هو مصدر البيانات.
import { h, modal, toast } from './ui.js';
import { Local, Net, hooks } from './rooms.js';
import { Patient } from './state.js';

const STAFF_TYPES = ['text', 'question', 'ack'];
const listeners = new Set();
const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

export const Direct = {
  supported: typeof RTCPeerConnection === 'function',
  patient: null,           // { pc, ch, timer, last }
  peers: new Map(),        // على هاتف الطبيب: roomId -> { pc, ch }
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  patientConnected() { return this.patient?.ch?.readyState === 'open'; },
  isLinked(id) { return this.peers.get(id)?.ch?.readyState === 'open'; },
  staffCount() { return [...this.peers.values()].filter(p => p.ch.readyState === 'open').length; },
  closePatient() {
    const p = this.patient; if (!p) return;
    clearInterval(p.timer); try { p.pc.close(); } catch { /* ignore */ }
    this.patient = null; emit();
  }
};

/* ---------- ترميز وصف الاتصال في نص قصير يصلح لرمز QR ---------- */
const b64 = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function pack(desc) {
  const json = JSON.stringify({ t: desc.type, s: desc.sdp });
  if ('CompressionStream' in window) {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'TZ' + b64(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  return 'TP' + b64(new TextEncoder().encode(json));
}
async function unpack(code) {
  code = (code || '').trim();
  let json;
  try {
    if (code.startsWith('TZ')) {
      const stream = new Blob([unb64(code.slice(2))]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      json = await new Response(stream).text();
    } else if (code.startsWith('TP')) json = new TextDecoder().decode(unb64(code.slice(2)));
    const o = JSON.parse(json);
    if (!o?.t || !o?.s) throw 0;
    return { type: o.t, sdp: o.s };
  } catch { throw new Error('الرمز غير صحيح. امسح رمز تطبيق «طبيبي يفهمني» فقط.'); }
}
const gathered = pc => new Promise(res => {
  if (pc.iceGatheringState === 'complete') return res();
  const t = setTimeout(res, 5000);
  pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
});
// بلا خوادم STUN/TURN: الاتصال داخل الشبكة المحلية فقط، ولا يمر عبر أي طرف ثالث.
const newPC = () => new RTCPeerConnection({ iceServers: [] });
const send = (ch, obj) => { if (ch?.readyState !== 'open') return false; ch.send(JSON.stringify(obj)); return true; };

/* ---------- جهة المريض ---------- */
async function patientOffer() {
  Direct.closePatient();
  const pc = newPC();
  const ch = pc.createDataChannel('tabibi');
  const st = Direct.patient = { pc, ch, timer: null, last: '' };
  const snap = async () => {
    const id = Patient.s.roomId; if (!id) return;
    let room; try { room = await Local.get(id); } catch { return; }
    const s = JSON.stringify(room);
    if (s !== st.last && send(ch, { t: 'snap', room })) st.last = s;
  };
  ch.onopen = () => { st.timer = setInterval(snap, 700); snap(); emit(); toast('🔗 تم الربط المباشر بهاتف الطبيب/الممرض.', 'success'); };
  ch.onclose = () => { clearInterval(st.timer); if (Direct.patient === st) { Direct.patient = null; emit(); toast('انقطع الربط المباشر بهاتف الطبيب.', 'error'); } };
  ch.onmessage = async e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    const id = Patient.s.roomId; if (!id) return;
    if (m.t === 'post' && STAFF_TYPES.includes(m.msg?.type)) {
      const { type, text, answerType, choices, signId } = m.msg;
      await Local.post(id, 'staff', { type, text: String(text || '').slice(0, 1000), answerType, choices: Array.isArray(choices) ? choices.slice(0, 8) : [], signId: signId || '' });
      snap();
    } else if (m.t === 'remove') {
      await Local.remove(id); Patient.resetRoom(); Direct.closePatient();
    }
  };
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return pack(pc.localDescription);
}
async function patientAccept(code) {
  const d = await unpack(code);
  if (d.type !== 'answer') throw new Error('هذا رمز المريض نفسه. امسح الرمز الظاهر على هاتف الطبيب.');
  if (!Direct.patient) throw new Error('ابدأ الربط من جديد.');
  await Direct.patient.pc.setRemoteDescription(d);
}

/* ---------- جهة الطبيب ---------- */
async function staffAnswer(code, onFirstRoom) {
  const d = await unpack(code);
  if (d.type !== 'offer') throw new Error('امسح الرمز الظاهر على هاتف المريض.');
  const pc = newPC();
  let roomId = null;
  pc.ondatachannel = ({ channel: ch }) => {
    ch.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t !== 'snap' || !m.room?.id) return;
      Local.putMirror(m.room);
      if (!roomId) { roomId = m.room.id; Direct.peers.set(roomId, { pc, ch }); emit(); onFirstRoom?.(roomId); }
    };
    ch.onclose = () => { if (roomId) { emit(); toast('انقطع الربط المباشر بهاتف المريض.', 'error'); } };
  };
  await pc.setRemoteDescription(d);
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  return pack(pc.localDescription);
}

// رسائل الطبيب لمقابلة مرتبطة مباشرة تُرسل لهاتف المريض بدل التخزين المحلي.
hooks.staffPost = (id, msg) => {
  if (!Direct.peers.has(id)) return Local.isMirror(id) ? Promise.reject(new Error('الربط المباشر منقطع')) : null;
  return send(Direct.peers.get(id).ch, { t: 'post', msg })
    ? Promise.resolve({ ok: true })
    : Promise.reject(new Error('الربط المباشر منقطع'));
};
hooks.staffRemove = id => {
  const p = Direct.peers.get(id); if (!p) return null;
  send(p.ch, { t: 'remove' });
  setTimeout(() => { try { p.pc.close(); } catch { /* ignore */ } }, 300);
  Direct.peers.delete(id); emit();
  return Local.remove(id);
};

/* ---------- رمز QR: عرض ومسح ---------- */
const loaded = {};
const loadScript = src => (loaded[src] ??= new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل أداة رمز QR'));
  document.head.append(s);
}));

async function qrEl(text) {
  await loadScript('js/vendor/qrcode.js');
  const q = window.qrcode(0, 'L'); q.addData(text); q.make();
  return h('div', { class: 'qr', role: 'img', 'aria-label': 'رمز QR للربط', html: q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }) });
}

/** نافذة مسح رمز QR بالكاميرا، مع إمكانية لصق الرمز نصيًا. تعيد النص أو null. */
function scanModal(title, hint) {
  return new Promise(resolve => {
    let stream, raf, done = false;
    const video = h('video', { playsinline: true, muted: true, class: 'scan-video', 'aria-label': 'الكاميرا' });
    const status = h('p', { class: 'note' }, 'جارٍ فتح الكاميرا…');
    const paste = h('textarea', { class: 'input', rows: '2', dir: 'ltr', placeholder: 'أو الصق الرمز هنا', 'aria-label': 'لصق الرمز' });
    const finish = v => { if (done) return; done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); m.close(); resolve(v); };
    const m = modal({
      title, wide: true,
      body: h('div', {}, h('p', {}, hint), video, status, paste),
      actions: [{ label: 'استخدم الرمز الملصوق', cls: 'primary', onclick: () => { if (!paste.value.trim()) { toast('الصق الرمز أولًا.', 'error'); return false; } finish(paste.value.trim()); return false; } },
        { label: 'إلغاء', onclick: () => { finish(null); return false; } }],
      onClose: () => finish(null)
    });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream; await video.play();
        status.textContent = 'وجّه الكاميرا إلى الرمز.';
        let detect;
        if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats?.())?.includes('qr_code')) {
          const bd = new BarcodeDetector({ formats: ['qr_code'] });
          detect = async () => (await bd.detect(video))[0]?.rawValue;
        } else {
          await loadScript('js/vendor/jsQR.js');
          const cv = document.createElement('canvas'); const cx = cv.getContext('2d', { willReadFrequently: true });
          detect = async () => {
            if (!video.videoWidth) return null;
            cv.width = video.videoWidth; cv.height = video.videoHeight; cx.drawImage(video, 0, 0);
            return window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height)?.data;
          };
        }
        const loop = async () => {
          if (done) return;
          try { const v = await detect(); if (v && v.startsWith('T')) return finish(v); } catch { /* إطار غير صالح */ }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        video.hidden = true;
        status.textContent = 'تعذّر فتح الكاميرا. اسمح بالكاميرا من إعدادات المتصفح، أو الصق الرمز نصيًا.';
      }
    })();
  });
}

const copyBtn = code => h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
  try { await navigator.clipboard.writeText(code); toast('تم نسخ الرمز.', 'success'); } catch { toast('تعذّر النسخ.', 'error'); }
} }, '📋 نسخ الرمز نصيًا');

const needLocal = () => {
  if (!Direct.supported) { toast('هذا المتصفح لا يدعم الربط المباشر.', 'error'); return false; }
  if (Net.mode !== 'local') { toast('الهاتف متصل بخادم المستشفى بالفعل، لا حاجة للربط المباشر.', 'info'); return false; }
  return true;
};

/** خطوات المريض: عرض رمزه ← مسح رمز الطبيب. */
export async function patientLinkFlow() {
  if (!needLocal()) return;
  const wait = modal({ title: 'ربط مباشر بهاتف الطبيب', body: h('p', { class: 'lead' }, 'جارٍ تجهيز الرمز…') });
  let code;
  try { code = await patientOffer(); } catch { wait.close(); return toast('تعذّر تجهيز الربط.', 'error'); }
  wait.close();
  const qr = await qrEl(code).catch(() => h('p', { class: 'note' }, 'تعذّر رسم الرمز، استخدم النسخ.'));
  modal({
    title: 'الخطوة 1 من 2', wide: true,
    body: h('div', { class: 'link-step' },
      h('p', { class: 'lead' }, 'اطلب من الطبيب أو الممرض أن يمسح هذا الرمز من لوحته: «ربط مباشر بهاتف مريض».'),
      qr, copyBtn(code),
      h('p', { class: 'note' }, 'يجب أن يكون الهاتفان على نفس الواي فاي، أو يفتح أحدهما نقطة اتصال ويتصل بها الآخر. لا يلزم إنترنت.')),
    actions: [{ label: 'التالي: امسح رمز الطبيب', cls: 'primary', onclick: async () => {
      const ans = await scanModal('الخطوة 2 من 2', 'امسح الرمز الظاهر الآن على هاتف الطبيب.');
      if (!ans) return;
      try {
        await patientAccept(ans);
        toast('جارٍ الاتصال…', 'info', 2500);
        setTimeout(() => { if (!Direct.patientConnected()) toast('لم يكتمل الربط. تأكد أن الهاتفين على نفس الشبكة ثم أعد المحاولة.', 'error', 7000); }, 10000);
      } catch (e) { toast(e.message, 'error'); }
    } }, { label: 'إلغاء', onclick: () => { Direct.closePatient(); } }]
  });
}

/** خطوات الطبيب: مسح رمز المريض ← عرض رمزه. */
export async function staffLinkFlow(onRoom) {
  if (!needLocal()) return;
  const offer = await scanModal('ربط مباشر بهاتف مريض', 'امسح الرمز الظاهر على هاتف المريض (من صفحة «المقابلة» ← «ربط مباشر»).');
  if (!offer) return;
  let code, m;
  try {
    code = await staffAnswer(offer, id => { m?.close(); toast('🔗 تم الربط بهاتف المريض.', 'success'); onRoom?.(id); });
  } catch (e) { return toast(e.message || 'تعذّر الربط.', 'error'); }
  const qr = await qrEl(code).catch(() => h('p', { class: 'note' }, 'تعذّر رسم الرمز، استخدم النسخ.'));
  m = modal({
    title: 'اطلب من المريض مسح هذا الرمز', wide: true,
    body: h('div', { class: 'link-step' }, h('p', { class: 'lead' }, 'على هاتف المريض: «التالي: امسح رمز الطبيب».'), qr, copyBtn(code),
      h('p', { class: 'note' }, 'ستُفتح المقابلة تلقائيًا عند اكتمال الربط.')),
    actions: [{ label: 'إغلاق' }]
  });
}
