// الأقسام المنقولة: فيديو شكوى بالإشارة، موعد مع مترجم، طلباتي، الحملات، عن التطبيق، اتصل بنا، بوابة المترجمين.
import { h, go, toast, badge, confirmBox, videoPlayer, showBig, pic } from './ui.js';
import { content, byId } from './db.js';
import { Net, subscribe } from './rooms.js';
import { Session } from './state.js';
import { Requests, myRequests, STATUS } from './requests.js';
import { CAMPAIGN_TYPES, COMPLAINT_SYMPTOMS } from './seed.js';
import { icon } from './icons.js';
import { ic, footLinks } from './screens-public.js';

const MAX_SEC = 90, MAX_BYTES = 60e6;
const SYM_PICS = { 'الصداع': 'face-with-head-bandage', 'ألم البطن': 'persevering-face', 'ألم الصدر': 'anatomical-heart', 'الدوخة': 'face-with-spiral-eyes',
  'الحرارة': 'face-with-thermometer', 'الغثيان': 'nauseated-face', 'الحساسية': 'sneezing-face', 'صعوبة التنفس': 'lungs' };
const CAMP_PICS = { vaccination: 'syringe', awareness: 'light-bulb', announcement: 'loudspeaker' };
const fmtDate = t => new Date(t).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
const field = (label, el, hint) => h('label', { class: 'field' }, label, el, hint && h('small', {}, hint));
const input = (attrs = {}) => h('input', { class: 'input', ...attrs });
const checkRow = (label, cls = '') => { const c = h('input', { type: 'checkbox', class: 'check' }); return [h('label', { class: 'check-row ' + cls }, c, h('span', {}, label)), c]; };
const statusBadge = r => { const [t, k] = STATUS[r.status] || STATUS.new; return badge(t, k); };
const modeNote = what => Net.mode === 'server'
  ? h('div', { class: 'alert ok' }, `سيصل ${what} إلى المترجمين المتفرغين عبر خادم المستشفى.`)
  : h('div', { class: 'alert warn' }, `هذا الهاتف غير متصل بخادم المستشفى، لذلك سيُحفظ ${what} على هذا الهاتف فقط ولن يصل إلى مترجم. يمكنك عرضه على الطبيب مباشرة من «طلباتي».`);

/* ---------- فيديو شكوى بالإشارة ---------- */
export function complaint(_, app) {
  let stream = null, recorder = null, chunks = [], blob = null, timer = null, startedAt = 0;
  const stage = h('div', { class: 'rec-stage' }, h('div', {}, pic('person-deaf', 'rec-pic'), h('p', {}, 'سجّل فيديو قصيرًا تشرح فيه ما تشعر به بلغة الإشارة')));
  const camBtn = h('button', { class: 'btn primary block', type: 'button' }, ic('camera'), 'تشغيل الكاميرا');
  const fileIn = h('input', { type: 'file', accept: 'video/*' });
  const fileBtn = h('label', { class: 'file-btn' }, ic('upload'), 'أو اختر فيديو من جهازك', fileIn);
  const camMsg = h('div');

  const stopStream = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };
  const showBlob = (b, fromFile) => {
    blob = b; stopStream(); clearInterval(timer);
    const v = h('video', { src: URL.createObjectURL(b), controls: true, playsinline: true, 'aria-label': 'معاينة فيديو الشكوى' });
    stage.replaceChildren(v);
    camBtn.replaceChildren(ic('rotate-ccw'), fromFile ? 'سجّل بالكاميرا بدلًا منه' : 'أعد التسجيل');
    camBtn.onclick = openCam; camBtn.className = 'btn secondary block';
  };
  const pickType = () => ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || '';
  async function openCam() {
    blob = null; camMsg.replaceChildren();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return camMsg.replaceChildren(h('div', { class: 'alert warn' }, 'هذا المتصفح لا يدعم التسجيل. اختر فيديو مسجّلًا من جهازك.'));
    }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: false }); }
    catch { return camMsg.replaceChildren(h('div', { class: 'alert warn' }, 'لم نتمكن من فتح الكاميرا. اسمح للتطبيق باستخدامها، أو اختر فيديو مسجّلًا من جهازك.')); }
    const v = h('video', { playsinline: true, muted: true, autoplay: true, 'aria-label': 'الكاميرا' }); v.srcObject = stream;
    stage.replaceChildren(v);
    camBtn.replaceChildren(ic('video'), 'ابدأ التسجيل'); camBtn.className = 'btn danger block';
    camBtn.onclick = startRec;
  }
  function startRec() {
    const type = pickType(); chunks = [];
    recorder = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 1_200_000 } : undefined);
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
    recorder.onstop = () => showBlob(new Blob(chunks, { type: (recorder.mimeType || type || 'video/webm').split(';')[0] }));
    recorder.start(1000); startedAt = Date.now();
    const t = h('span', { class: 'rec-timer' }, '0'); stage.append(t);
    timer = setInterval(() => { const s = Math.floor((Date.now() - startedAt) / 1000); t.textContent = `● ${s} / ${MAX_SEC}`; if (s >= MAX_SEC) stopRec(); }, 250);
    camBtn.replaceChildren(ic('square'), 'إيقاف التسجيل'); camBtn.onclick = stopRec;
  }
  function stopRec() { clearInterval(timer); if (recorder?.state === 'recording') recorder.stop(); }
  camBtn.onclick = openCam;
  fileIn.onchange = () => {
    const f = fileIn.files[0]; if (!f) return;
    if (!f.type.startsWith('video/')) return toast('الملف المختار ليس فيديو.', 'error');
    if (f.size > MAX_BYTES) return toast('الفيديو أكبر من 60 ميجابايت. اختر فيديو أقصر.', 'error');
    showBlob(f, true);
  };

  const chosen = new Set();
  const chips = h('div', { class: 'sym-chips' }, COMPLAINT_SYMPTOMS.map(n => {
    const b = h('button', { class: 'sym-chip', type: 'button', 'aria-pressed': 'false' }, pic(SYM_PICS[n]), h('span', {}, n));
    b.onclick = () => { chosen.has(n) ? chosen.delete(n) : chosen.add(n); b.setAttribute('aria-pressed', chosen.has(n)); urgentBox.replaceChildren(urgentHint()); };
    return b;
  }));
  const urgentBox = h('div');
  const urgentHint = () => (chosen.has('صعوبة التنفس') || chosen.has('ألم الصدر'))
    ? h('div', { class: 'alert urgent' }, h('strong', {}, 'لا تنتظر رد المترجم.'), h('p', {}, 'صعوبة التنفس أو ألم الصدر تحتاج مساعدة طبية فورًا.'),
      h('button', { class: 'btn danger', type: 'button', onclick: () => app.helpNow() }, ic('siren'), 'أحتاج مساعدة الآن'))
    : null;
  const name = input({ placeholder: 'مثال: منى', maxlength: '40' });
  const clinic = input({ placeholder: 'مثال: عيادة الباطنة — د. سامي', maxlength: '80' });
  const note = h('textarea', { class: 'input', rows: '3', maxlength: '500', placeholder: 'مثال: الألم بدأ أمس في المساء' });
  const [urgentRow, urgent] = checkRow('حالتي مستعجلة — قدّموني على غيري', 'urgent-row');
  const [consentRow, consent] = checkRow('أوافق على عرض الفيديو على مترجم متفرغ وعلى الطبيب المعالج فقط، وأن تُحفظ الترجمة مع الطلب.');
  const err = h('div');
  const sendBtn = h('button', { class: 'btn primary block', type: 'button' }, ic('send'), 'إرسال الفيديو للمترجم');
  sendBtn.onclick = async () => {
    err.replaceChildren();
    if (!blob) return err.replaceChildren(h('div', { class: 'alert urgent', role: 'alert' }, 'سجّل فيديو الشكوى أو اختره من جهازك أولًا.'));
    if (!consent.checked) return err.replaceChildren(h('div', { class: 'alert urgent', role: 'alert' }, 'يجب الموافقة على عرض الفيديو على المترجم والطبيب قبل الإرسال.'));
    sendBtn.disabled = true; sendBtn.replaceChildren(ic('hourglass'), 'جارٍ الإرسال…');
    try {
      const ref = await Requests.create({ kind: 'complaint', symptoms: [...chosen], firstName: name.value.trim(), clinic: clinic.value.trim(), note: note.value.trim(), urgent: urgent.checked, consent: true }, blob);
      myRequests.add({ ...ref, kind: 'complaint', createdAt: Date.now() });
      toast(ref.mode === 'server' ? 'أُرسلت شكواك إلى المترجم. ستجد الرد في «طلباتي».' : 'حُفظت الشكوى على هذا الهاتف فقط.', ref.mode === 'server' ? 'success' : 'info', 6000);
      go('/requests');
    } catch (e) {
      sendBtn.disabled = false; sendBtn.replaceChildren(ic('send'), 'إرسال الفيديو للمترجم');
      err.replaceChildren(h('div', { class: 'alert urgent', role: 'alert' }, e.status === 413 ? 'الفيديو كبير جدًا. سجّل فيديو أقصر.' : 'تعذّر الإرسال. تحقق من الاتصال ثم حاول مرة أخرى.'));
    }
  };

  return {
    title: 'فيديو شكوى بلغة الإشارة', sub: 'سجّل شكواك بالإشارة، ومترجم متفرغ يترجمها للطبيب.',
    cleanup: () => { stopRec(); stopStream(); clearInterval(timer); },
    el: h('div', {},
      modeNote('الطلب'),
      h('p', { class: 'step-label' }, '١ · الفيديو'),
      h('div', { class: 'card' }, stage, camBtn, fileBtn,
        h('p', { class: 'note' }, `الحد الأقصى للتسجيل ${MAX_SEC} ثانية. لا تحتاج أن تتكلم — استخدم إشارتك الطبيعية. لا يُسجَّل صوت.`), camMsg),
      h('p', { class: 'step-label' }, '٢ · عَرَضك (اختياري)'),
      h('div', { class: 'card' }, chips, urgentBox,
        field('اسمك الأول (اختياري)', name), field('العيادة أو الطبيب المُوجَّه له الفيديو (اختياري)', clinic), field('ملاحظة قصيرة (اختياري)', note)),
      h('div', { class: 'card' }, urgentRow, consentRow, err, sendBtn,
        h('p', { class: 'note' }, 'الفيديو لا يظهر إلا للمترجم المتفرغ والطبيب المعالج، ويُحذف تلقائيًا بعد 7 أيام، ويمكنك حذفه قبل ذلك من «حسابي».')))
  };
}

/* ---------- موعد عيادة مع مترجم ---------- */
export function appointment() {
  const today = new Date().toISOString().slice(0, 10);
  const clinic = input({ placeholder: 'مثال: مستشفى الدمرداش — عيادة العظام', maxlength: '80' });
  const date = input({ type: 'date', min: today, dir: 'ltr' });
  const time = input({ type: 'time', dir: 'ltr' });
  const doctor = input({ maxlength: '60' });
  const name = input({ maxlength: '40' });
  const phone = input({ type: 'tel', inputmode: 'tel', dir: 'ltr', maxlength: '20' });
  const note = h('textarea', { class: 'input', rows: '3', maxlength: '500' });
  const err = h('div');
  const btn = h('button', { class: 'btn primary block', type: 'button' }, ic('send'), 'إرسال الموعد لطلب مترجم');
  btn.onclick = async () => {
    err.replaceChildren();
    const miss = [[clinic, 'اسم العيادة أو المستشفى'], [date, 'تاريخ الموعد'], [time, 'الساعة']].find(([el]) => !el.value.trim());
    if (miss) { miss[0].focus(); return err.replaceChildren(h('div', { class: 'alert urgent', role: 'alert' }, 'اكتب ' + miss[1] + '.')); }
    if (date.value < today) return err.replaceChildren(h('div', { class: 'alert urgent', role: 'alert' }, 'تاريخ الموعد في الماضي.'));
    btn.disabled = true;
    try {
      const ref = await Requests.create({ kind: 'appointment', clinic: clinic.value.trim(), date: date.value, time: time.value, doctor: doctor.value.trim(), firstName: name.value.trim(), phone: phone.value.trim(), note: note.value.trim() });
      myRequests.add({ ...ref, kind: 'appointment', createdAt: Date.now() });
      toast(ref.mode === 'server' ? 'أُرسل طلبك. ستجد رد المترجم في «طلباتي».' : 'حُفظ الطلب على هذا الهاتف فقط.', ref.mode === 'server' ? 'success' : 'info', 6000);
      go('/requests');
    } catch { btn.disabled = false; err.replaceChildren(h('div', { class: 'alert urgent', role: 'alert' }, 'تعذّر الإرسال. تحقق من الاتصال ثم حاول مرة أخرى.')); }
  };
  return {
    title: 'موعد عيادة مع مترجم', sub: 'أبلغنا بموعدك، ونجهّز لك مترجم إشارة يكون معك في العيادة.',
    el: h('div', {}, h('div', { class: 'page-art' }, pic('spiral-calendar'), pic('handshake'), pic('hospital')), modeNote('طلب الموعد'),
      h('div', { class: 'card' }, h('h2', {}, 'بيانات الموعد'),
        field('اسم العيادة أو المستشفى *', clinic),
        h('div', { class: 'btn-row' }, h('div', { style: 'flex:1;min-width:150px' }, field('تاريخ الموعد *', date)), h('div', { style: 'flex:1;min-width:120px' }, field('الساعة *', time))),
        field('اسم الطبيب (اختياري)', doctor), field('اسمك الأول (اختياري)', name),
        field('رقم للتواصل (اختياري)', phone, 'يُرسل للمترجم فقط، ليتواصل معك برسالة مكتوبة.'),
        field('ملاحظة للمترجم (اختياري)', note), err, btn))
  };
}

/* ---------- طلباتي ---------- */
export function requestsPage() {
  const box = h('div');
  const refs = myRequests.all();
  const load = async () => Promise.all(refs.map(async ref => { try { return { ref, r: await Requests.get(ref) }; } catch (e) { return { ref, err: e.status || 'net' }; } }));
  const card = ({ ref, r, err }) => {
    const isC = ref.kind === 'complaint';
    const head = h('div', { class: 'row-actions', style: 'align-items:center' },
      pic(isC ? 'video-camera' : 'spiral-calendar', 'req-pic'),
      h('span', { class: 'row-main' }, h('strong', {}, isC ? 'فيديو شكوى بالإشارة' : 'موعد عيادة مع مترجم'), h('small', {}, fmtDate(ref.createdAt))),
      r ? (ref.mode === 'local' ? badge('على هذا الهاتف فقط', 'warn') : statusBadge(r)) : badge(err === 404 ? 'حُذف أو انتهت مدته' : 'تعذّر التحميل', err === 404 ? 'warn' : 'no'));
    const body = h('div');
    if (r) {
      if (ref.mode === 'local') body.append(h('p', { class: 'note' }, 'محفوظ على هذا الهاتف فقط — لم يُرسل إلى مترجم.'));
      if (!isC) body.append(h('dl', { class: 'kv' }, h('dt', {}, 'العيادة'), h('dd', {}, r.clinic), h('dt', {}, 'الموعد'), h('dd', { dir: 'ltr', style: 'text-align:right' }, `${r.date} ${r.time}`), r.doctor && [h('dt', {}, 'الطبيب'), h('dd', {}, r.doctor)]));
      if (isC && r.symptoms?.length) body.append(h('div', { class: 'chips' }, r.symptoms.map(s => h('span', { class: 'chip' }, SYM_PICS[s] && pic(SYM_PICS[s], 'chip-pic'), s))));
      if (r.reply?.text) body.append(h('div', { class: 'reply-box' }, h('small', {}, isC ? 'ترجمة المترجم لشكواك' : 'رد المترجم'), h('p', {}, r.reply.text)));
      const actions = h('div', { class: 'row-actions' });
      if (isC && r.hasVideo) actions.append(h('button', { class: 'btn ghost', type: 'button', onclick: async e => {
        const url = await Requests.videoUrl(r, ref); if (!url) return toast('الفيديو غير موجود.', 'error');
        e.currentTarget.replaceWith(h('video', { src: url, controls: true, playsinline: true, style: 'width:100%;border-radius:14px;background:#000;max-height:50vh' }));
      } }, ic('play'), 'شاهد الفيديو'));
      if (r.reply?.text) actions.append(h('button', { class: 'btn primary', type: 'button', onclick: () => showBig({ text: r.reply.text }) }, ic('eye'), 'اعرضها للطبيب بخط كبير'));
      body.append(actions);
    }
    const del = h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
      if (!await confirmBox('حذف هذا الطلب نهائيًا؟', 'حذف')) return;
      try { await Requests.remove(ref); } catch (e) { if (e.status !== 404) return toast('تعذّر الحذف. حاول مرة أخرى.', 'error'); }
      myRequests.remove(ref.id); toast('تم الحذف.', 'success'); draw(await load());
    } }, ic('trash-2'), 'حذف');
    return h('div', { class: 'card' }, head, body, del);
  };
  const draw = items => box.replaceChildren(...(items.length ? items.map(card) : [h('div', { class: 'empty' }, pic('memo', 'empty-pic'), h('p', {}, 'لا توجد طلبات بعد.'),
    h('a', { class: 'btn primary', href: '#/complaint' }, ic('video'), 'سجّل شكوى بالإشارة'))]));
  const unsub = refs.length ? subscribe(load, items => items && draw(items), 6000) : (draw([]), null);
  return { title: 'طلباتي', sub: 'شكاوى الفيديو وطلبات المواعيد وردود المترجمين', cleanup: () => unsub?.(), el: box };
}

/* ---------- الحملات ---------- */
export function campaigns() {
  const c = content(); let filter = '';
  const tabs = h('div', { class: 'chips' }); const list = h('div');
  const draw = () => {
    tabs.replaceChildren(...[['', 'الكل'], ...Object.entries(CAMPAIGN_TYPES)].map(([k, l]) =>
      h('button', { class: 'chip btn-chip', type: 'button', 'aria-pressed': filter === k, onclick: () => { filter = k; draw(); } }, k && pic(CAMP_PICS[k], 'chip-pic'), l)));
    const items = c.campaigns.filter(x => x.published && (!filter || x.type === filter));
    list.replaceChildren(...(items.length ? items.map(x => {
      const sign = byId(c.signs, x.signId);
      return h('article', { class: 'camp' }, h('div', { class: 'camp-head' }, pic(CAMP_PICS[x.type] || 'loudspeaker', 'camp-pic'), badge(CAMPAIGN_TYPES[x.type] || 'إعلان', x.type === 'vaccination' ? 'ok' : x.type === 'awareness' ? 'info' : 'warn')),
        h('h3', {}, x.title),
        (x.date || x.place) && h('div', { class: 'camp-meta' }, x.date && h('span', { html: icon('calendar') + ' ' + x.date.replace(/[<>&]/g, '') }), x.place && h('span', { html: icon('map-pin') + ' ' + x.place.replace(/[<>&]/g, '') })),
        h('p', {}, x.body), sign && videoPlayer(sign));
    }) : [h('div', { class: 'empty' }, pic('megaphone', 'empty-pic'), h('p', {}, 'لا توجد حملات منشورة حاليًا.'), h('small', {}, 'ستظهر هنا حملات التطعيم والتوعية فور نشرها من لوحة المحتوى.'))]));
  };
  draw();
  return { title: 'الحملات والإشعارات', sub: 'حملات التطعيم والتوعية للصم، مع فيديو إشارة عند توفره.', el: h('div', {}, tabs, list) };
}

/* ---------- عن التطبيق ---------- */
export function about() {
  return {
    title: 'عن التطبيق', sub: 'منصة تواصل طبي لخدمة الصم وضعاف السمع في مصر.',
    el: h('div', {},
      h('div', { class: 'page-art' }, pic('person-deaf'), pic('speech-balloon'), pic('health-worker')),
      h('div', { class: 'card' },
        h('p', {}, '«طبيبي يفهمني» تطبيق تواصل طبي صُمّم لخدمة الصم وضعاف السمع في مصر. هدفه أن يستطيع المريض الأصم أن يشرح ما يشعر به أمام الطبيب أو الممرض دون أن يكون هناك مترجم إشارة حاضرًا.'),
        h('p', {}, 'يعتمد التطبيق على الصور والكتابة الكبيرة وفيديوهات لغة الإشارة بدلًا من الكلام. يختار المريض أعراضه من صور، ويحدد مكان الألم وشدته، ويكتب رسالة، أو يسجّل شكواه بلغة الإشارة ليترجمها مترجم متفرغ. ويطرح الطبيب أسئلته ويستقبل الإجابات في نفس المحادثة، ويمكن طلب مترجم يرافق المريض في موعد العيادة.'),
        h('p', {}, 'الأعراض والأسئلة تعمل دون إنترنت بعد فتح التطبيق مرة واحدة، ويمكن ربط هاتف المريض بهاتف الطبيب مباشرة على نفس الشبكة.')),
      h('div', { class: 'card' }, h('h2', {}, 'لمن هذا التطبيق؟'),
        h('ul', { class: 'plain' }, h('li', {}, 'المرضى الصم وضعاف السمع وأسرهم.'), h('li', {}, 'الأطباء والممرضون في العيادات والمستشفيات.'), h('li', {}, 'مترجمو لغة الإشارة المتفرغون.'))),
      h('div', { class: 'alert warn' }, 'التطبيق أداة تواصل فقط. لا يقدّم تشخيصًا ولا علاجًا ولا جرعات دوائية، ولا يغني عن مترجم الإشارة عند توفره. هذه نسخة أولى ببيانات تجريبية.'),
      footLinks())
  };
}

/* ---------- اتصل بنا ---------- */
export function contact(_, app) {
  const email = (content().settings?.contactEmail || '').trim();
  return {
    title: 'اتصل بنا', sub: 'أسئلة، ملاحظات، أو طلب مساعدة في استخدام التطبيق.',
    el: h('div', {},
      h('div', { class: 'page-art' }, pic('e-mail'), pic('mobile-phone'), pic('ambulance')),
      h('div', { class: 'card' }, h('h2', {}, 'البريد الإلكتروني'),
        email ? [h('p', { class: 'note' }, 'أرسل رسالتك على البريد التالي. اكتب نوع جهازك ووصفًا قصيرًا للمشكلة إن وُجدت.'),
          h('a', { class: 'btn secondary block', href: 'mailto:' + encodeURIComponent(email).replace('%40', '@'), dir: 'ltr' }, ic('mail'), email)]
          : h('p', { class: 'note' }, 'لم يُضف بريد للتواصل بعد. يضيفه مدير المحتوى من لوحة الإدارة ← أدوات.')),
      h('div', { class: 'card' }, h('h2', {}, 'داخل العيادة أو المستشفى'),
        h('p', { class: 'note' }, 'لطلب مساعدة وأنت في العيادة، استخدم «أحتاج مساعدة الآن» لعرض رسالة كبيرة للطبيب أو الممرض القريب منك.'),
        h('button', { class: 'btn danger block', type: 'button', onclick: () => app.helpNow() }, ic('siren'), 'أحتاج مساعدة الآن'),
        h('a', { class: 'btn secondary block', href: '#/complaint' }, ic('video'), 'سجّل شكوى بالإشارة')),
      h('div', { class: 'alert urgent' }, h('strong', {}, 'في الحالات الطارئة'),
        h('p', {}, 'صعوبة التنفس أو ألم الصدر الشديد أو فقدان الوعي تحتاج تدخلًا فوريًا. الإسعاف المصري: 123. إن لم تستطع الاتصال صوتيًا، اطلب من شخص بجوارك أن يتصل، ولا تنتظر ردًا على البريد.'),
        h('a', { class: 'btn danger', href: 'tel:123' }, ic('phone'), 'الإسعاف 123')),
      footLinks())
  };
}

/* ---------- بوابة المترجمين ---------- */
export const interpreterSession = () => { const s = Session.get(); return s?.role === 'interpreter' ? s : null; };
export function interpreterPortal({ tab = 'complaints' }) {
  const s = interpreterSession();
  const box = h('div');
  const drafts = new Map();
  const complaintCard = r => {
    const ta = h('textarea', { class: 'input big-input', rows: '3', placeholder: 'اكتب ترجمة الشكوى بالعربية كما سيقرؤها الطبيب…', 'aria-label': 'الترجمة' }, drafts.get(r.id) || '');
    ta.oninput = () => drafts.set(r.id, ta.value);
    const vid = h('div');
    if (r.hasVideo) Requests.videoUrl(r).then(u => u && vid.replaceChildren(h('video', { src: u, controls: true, playsinline: true, style: 'width:100%;border-radius:14px;background:#000;max-height:55vh' })));
    return h('div', { class: 'card' + (r.urgent && r.status === 'new' ? ' urgent-card' : '') },
      h('div', { class: 'row-actions', style: 'align-items:center' },
        r.urgent && badge('⚠ مستعجل', 'no'), statusBadge(r), h('small', { class: 'note', style: 'margin:0' }, fmtDate(r.createdAt))),
      h('dl', { class: 'kv' }, r.firstName && [h('dt', {}, 'الاسم'), h('dd', {}, r.firstName)], r.clinic && [h('dt', {}, 'موجّه إلى'), h('dd', {}, r.clinic)], r.note && [h('dt', {}, 'ملاحظة'), h('dd', {}, r.note)]),
      r.symptoms?.length > 0 && h('div', { class: 'chips' }, r.symptoms.map(x => h('span', { class: 'chip' }, SYM_PICS[x] && pic(SYM_PICS[x], 'chip-pic'), x))),
      vid,
      r.reply ? h('div', { class: 'reply-box' }, h('small', {}, 'ترجمتك (' + r.reply.by + ')'), h('p', {}, r.reply.text))
        : [ta, h('button', { class: 'btn primary block', type: 'button', onclick: async e => {
          if (!ta.value.trim()) return toast('اكتب الترجمة أولًا.', 'error');
          e.currentTarget.disabled = true;
          try { await Requests.reply(r.id, { text: ta.value.trim() }); drafts.delete(r.id); toast('أُرسلت الترجمة للمريض.', 'success'); refresh(); }
          catch { e.currentTarget.disabled = false; toast('تعذّر الإرسال.', 'error'); }
        } }, ic('send'), 'إرسال الترجمة')]);
  };
  const apptCard = r => {
    const ta = h('textarea', { class: 'input', rows: '2', placeholder: 'رسالة للمريض (مثال: سأكون عند باب العيادة 9:45)', 'aria-label': 'رسالة للمريض' }, drafts.get(r.id) || '');
    ta.oninput = () => drafts.set(r.id, ta.value);
    const answer = status => async e => {
      e.currentTarget.disabled = true;
      try { await Requests.reply(r.id, { status, text: ta.value.trim() }); drafts.delete(r.id); toast('تم إرسال الرد.', 'success'); refresh(); }
      catch { e.currentTarget.disabled = false; toast('تعذّر الإرسال.', 'error'); }
    };
    return h('div', { class: 'card' },
      h('div', { class: 'row-actions', style: 'align-items:center' }, statusBadge(r), h('small', { class: 'note', style: 'margin:0' }, 'أُرسل ' + fmtDate(r.createdAt))),
      h('dl', { class: 'kv' }, h('dt', {}, 'العيادة'), h('dd', {}, r.clinic), h('dt', {}, 'الموعد'), h('dd', { dir: 'ltr', style: 'text-align:right' }, `${r.date} ${r.time}`),
        r.doctor && [h('dt', {}, 'الطبيب'), h('dd', {}, r.doctor)], r.firstName && [h('dt', {}, 'الاسم'), h('dd', {}, r.firstName)],
        r.phone && [h('dt', {}, 'للتواصل'), h('dd', { dir: 'ltr', style: 'text-align:right' }, r.phone)], r.note && [h('dt', {}, 'ملاحظة'), h('dd', {}, r.note)]),
      r.reply ? h('div', { class: 'reply-box' }, h('small', {}, 'ردّك (' + r.reply.by + ')'), h('p', {}, r.reply.text || '—'))
        : [ta, h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', type: 'button', onclick: answer('accepted') }, ic('user-check'), 'سأحضر مع المريض'),
          h('button', { class: 'btn ghost', type: 'button', onclick: answer('declined') }, ic('x'), 'أعتذر'))]);
  };
  let last = [];
  const draw = list => {
    last = list;
    const items = list.filter(r => r.kind === (tab === 'complaints' ? 'complaint' : 'appointment'));
    const pending = items.filter(r => r.status === 'new').length;
    box.replaceChildren(
      h('p', { class: 'note' }, pending ? `${pending} طلب بانتظار الرد.` : 'لا توجد طلبات جديدة.'),
      ...(items.length ? items.map(tab === 'complaints' ? complaintCard : apptCard) : [h('p', { class: 'empty' }, 'لا توجد طلبات.')]));
  };
  // لا نعيد الرسم أثناء الكتابة حتى لا يضيع النص
  const typing = () => document.activeElement?.tagName === 'TEXTAREA' && box.contains(document.activeElement);
  let unsub;
  const refresh = () => { unsub?.(); unsub = subscribe(() => Requests.list(), (list, err) => {
    if (err) {
      if (err.status === 401) { Session.clear(); toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error'); return go('/login/interpreter'); }
      return box.replaceChildren(h('div', { class: 'alert warn' }, 'تعذّر الاتصال بالخادم. سنحاول مجددًا.'));
    }
    if (!typing()) draw(list); else last = list;
  }, 5000); };
  refresh();
  return {
    title: 'بوابة المترجمين', sub: s.name, noFab: true, noNav: true, cleanup: () => unsub?.(),
    el: h('div', {},
      Net.mode !== 'server' && h('div', { class: 'alert warn' }, 'بدون خادم المستشفى ترى فقط الطلبات المحفوظة على هذا الجهاز. لتصلك طلبات المرضى شغّل التطبيق من خادم المستشفى.'),
      h('div', { class: 'tabs' },
        h('a', { class: 'tab' + (tab === 'complaints' ? ' on' : ''), href: '#/interpreter/complaints' }, 'فيديوهات الشكاوى'),
        h('a', { class: 'tab' + (tab === 'appointments' ? ' on' : ''), href: '#/interpreter/appointments' }, 'طلبات المواعيد'),
        h('button', { class: 'tab', type: 'button', onclick: () => { Session.clear(); toast('تم تسجيل الخروج.', 'success'); go('/'); } }, 'تسجيل الخروج')),
      box)
  };
}
