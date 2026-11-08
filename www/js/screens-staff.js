// شاشات الطبيب/الممرض: تسجيل الدخول، لوحة المرضى، غرفة المقابلة.
import { h, go, toast, confirmBox, badge } from './ui.js';
import { content } from './db.js';
import { Session } from './state.js';
import { Rooms, Net, subscribe, serverLogin } from './rooms.js';
import { DEMO_STAFF } from './staff-demo.js';
import { renderThread } from './screens-patient.js';
import { netBadge } from './screens-public.js';
import { SEVERITY, ANSWER_TYPES } from './seed.js';

/* ---------- تسجيل الدخول ---------- */
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function localLogin(u, p) {
  if (!globalThis.crypto?.subtle) throw Object.assign(new Error('insecure'), { msg: 'الدخول التجريبي يتطلب اتصالًا آمنًا (https أو localhost). استخدم خادم المستشفى.' });
  const acc = DEMO_STAFF[u];
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(acc?.salt || 'AAAAAAAAAAAAAAAAAAAAAA=='), iterations: acc?.iter || 100000 }, key, 256));
  const want = acc ? b64(acc.hash) : new Uint8Array(32);
  let diff = acc ? 0 : 1; for (let i = 0; i < 32; i++) diff |= bits[i] ^ want[i];
  if (diff) throw Object.assign(new Error('bad'), { msg: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
  return { token: 'local', role: acc.role, name: acc.name, user: u };
}

let attempts = 0, lockUntil = 0;
export function login({ role, room }) {
  const isAdmin = role === 'admin';
  const user = h('input', { class: 'input', autocomplete: 'username', dir: 'ltr', required: true, 'aria-label': 'اسم المستخدم' });
  const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', dir: 'ltr', required: true, 'aria-label': 'كلمة المرور' });
  const err = h('div', { class: 'alert urgent', role: 'alert', hidden: true });
  const form = h('form', { class: 'card', novalidate: true },
    h('h2', {}, isAdmin ? 'دخول مسؤول المحتوى' : 'دخول الطبيب أو الممرض'),
    h('p', { class: 'note' }, 'الدخول مطلوب لحماية بيانات المرضى.'), netBadge(),
    h('label', { class: 'field' }, 'اسم المستخدم', user), h('label', { class: 'field' }, 'كلمة المرور', pass), err,
    h('button', { class: 'btn primary block', type: 'submit' }, 'تسجيل الدخول'));
  const fail = m => { err.hidden = false; err.textContent = m; };
  form.onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    if (Date.now() < lockUntil) return fail('محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.');
    if (!user.value.trim() || !pass.value) return fail('اكتب اسم المستخدم وكلمة المرور.');
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const s = Net.mode === 'server' ? { ...(await serverLogin(user.value.trim(), pass.value)), user: user.value.trim() } : await localLogin(user.value.trim(), pass.value);
      const ok = isAdmin ? s.role === 'admin' : (s.role === 'doctor' || s.role === 'nurse');
      if (!ok) return fail('هذا الحساب لا يملك صلاحية هذه الصفحة.');
      attempts = 0; Session.set(s); toast('أهلًا ' + s.name, 'success');
      go(isAdmin ? '/admin' : (room ? '/room/' + room : '/staff'));
    } catch (ex) {
      attempts++; if (attempts >= 5) { lockUntil = Date.now() + 60e3; attempts = 0; }
      fail(ex.msg || ex.data?.message || (ex.status ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'تعذّر الاتصال بالخادم.'));
    } finally { btn.disabled = false; pass.value = ''; }
  };
  const demo = h('details', { class: 'card' }, h('summary', {}, 'حسابات تجريبية (للاختبار فقط)'),
    h('ul', { class: 'plain', dir: 'ltr' },
      h('li', {}, 'dr.demo / Demo@Doctor1'), h('li', {}, 'nurse.demo / Demo@Nurse1'), h('li', {}, 'admin.demo / Demo@Admin1')),
    h('p', { class: 'note' }, 'احذف هذه الحسابات قبل الاستخدام الفعلي (انظر README).'));
  return { title: isAdmin ? 'دخول الإدارة' : 'دخول الطبيب/الممرض', back: '/', noFab: true, el: h('div', {}, form, demo) };
}

export const staffSession = () => { const s = Session.get(); return s && (s.role === 'doctor' || s.role === 'nurse') ? s : null; };
export const adminSession = () => { const s = Session.get(); return s?.role === 'admin' ? s : null; };

const logoutBtn = () => h('button', { class: 'btn ghost', type: 'button', onclick: () => { Session.clear(); toast('تم تسجيل الخروج.', 'success'); go('/'); } }, 'تسجيل الخروج');

/* ---------- تنبيه مرئي لطلب المساعدة ---------- */
const seen = new Set();
let flash = null;
function notifyHelp(list) {
  const fresh = list.filter(r => r.helpAt && !seen.has(r.id + r.helpAt));
  fresh.forEach(r => seen.add(r.id + r.helpAt));
  if (fresh.length) { navigator.vibrate?.([300, 150, 300, 150, 300]); toast('🆘 مريض يطلب المساعدة الآن!', 'error', 8000); }
  const active = list.some(r => r.helpAt);
  if (active && !flash) { let on = false; flash = setInterval(() => { on = !on; document.title = on ? '🆘 طلب مساعدة!' : 'طبيبي يفهمني'; }, 900); }
  if (!active && flash) { clearInterval(flash); flash = null; document.title = 'طبيبي يفهمني'; }
}
const stopFlash = () => { if (flash) { clearInterval(flash); flash = null; document.title = 'طبيبي يفهمني'; } };

/* ---------- لوحة الطبيب ---------- */
export function staffDash() {
  const s = staffSession();
  const code = h('input', { class: 'input code-input', inputmode: 'numeric', maxlength: '4', dir: 'ltr', placeholder: '0000', 'aria-label': 'رمز المقابلة' });
  const listBox = h('div', { class: 'list' }); const alertBox = h('div');
  const open = async () => {
    if (!/^\d{4}$/.test(code.value)) return toast('اكتب رمزًا من 4 أرقام.', 'error');
    try { const r = await Rooms.byCode(code.value); go('/room/' + r.id); }
    catch (e) { toast(e.status === 401 ? 'انتهت الجلسة. سجّل الدخول من جديد.' : 'لا توجد مقابلة بهذا الرمز.', 'error'); }
  };
  code.onkeydown = e => { if (e.key === 'Enter') open(); };
  const unsub = subscribe(() => Rooms.list(), (list, err) => {
    if (err) {
      if (err.status === 401) { Session.clear(); toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error'); return go('/login/staff'); }
      return listBox.replaceChildren(h('div', { class: 'alert warn' }, '⚠️ تعذّر الاتصال بالخادم. سنحاول مجددًا.'));
    }
    notifyHelp(list);
    const helps = list.filter(r => r.helpAt);
    alertBox.replaceChildren(...(helps.length ? [h('div', { class: 'alert urgent flash', role: 'alert' }, h('strong', {}, `🆘 ${helps.length} مريض يطلب المساعدة الآن`), h('p', {}, helps.map(r => 'مقابلة ' + r.code).join(' ، ')))] : []));
    list.sort((a, b) => (b.helpAt ? 1 : 0) - (a.helpAt ? 1 : 0) || b.lastAt - a.lastAt);
    listBox.replaceChildren(...(list.length ? list.map(r => h('a', { class: 'row' + (r.helpAt ? ' help' : ''), href: '#/room/' + r.id },
      h('span', { class: 'row-main' }, h('strong', {}, 'مقابلة ' + r.code + (r.alias ? ' — ' + r.alias : '')), h('small', {}, 'آخر نشاط: ' + new Date(r.lastAt).toLocaleTimeString('ar-EG'))),
      r.helpAt ? badge('🆘 يطلب مساعدة', 'no') : badge(r.shared ? 'شارك أعراضه' : 'لم يشارك الأعراض', r.shared ? 'ok' : 'info'))) : [h('p', { class: 'empty' }, 'لا توجد مقابلات مفتوحة حاليًا.')]));
  });
  return {
    title: 'لوحة الطبيب/الممرض', cleanup: () => { unsub(); stopFlash(); }, noFab: true,
    el: h('div', {},
      h('div', { class: 'card' }, h('strong', {}, s.name), ' ', badge(s.role === 'doctor' ? 'طبيب' : 'ممرض', 'info'), ' ', logoutBtn(), h('div', {}, netBadge()),
        Net.mode === 'local' && h('p', { class: 'note' }, 'وضع تجريبي: ترى فقط المقابلات المفتوحة على هذا الجهاز/المتصفح.')),
      alertBox,
      h('div', { class: 'card' }, h('h2', {}, 'فتح مقابلة برمزها'), h('label', { class: 'field' }, 'رمز المقابلة الظاهر على هاتف المريض', code),
        h('button', { class: 'btn primary block', type: 'button', onclick: open }, 'فتح المقابلة')),
      h('h2', {}, 'المقابلات المفتوحة'), listBox)
  };
}

/* ---------- غرفة المقابلة (الطبيب) ---------- */
export function staffRoom({ id }) {
  const c = content(); let unsub;
  const helpBox = h('div'), sumBox = h('div', { class: 'card' }), thread = h('div', { class: 'card' });
  const head = h('div', { class: 'card' });

  const sendQuestion = async q => {
    try {
      await Rooms.post(id, 'staff', { type: 'question', text: q.text, signId: q.signId || '', answerType: q.answerType, choices: q.choices || [] });
      toast('أُرسل السؤال إلى شاشة المريض.', 'success', 2500);
    } catch { toast('تعذّر إرسال السؤال.', 'error'); }
  };

  /* مركّب الرسائل والأسئلة */
  const txt = h('textarea', { class: 'input huge-input', rows: '3', placeholder: 'اكتب هنا بخط كبير وواضح…', 'aria-label': 'نص الرسالة أو السؤال' });
  const typeSel = h('select', { class: 'input', 'aria-label': 'نوع الإجابة المطلوبة' }, Object.entries(ANSWER_TYPES).map(([k, l]) => h('option', { value: k }, l)));
  const choicesIn = h('input', { class: 'input', placeholder: 'اكتب الاختيارات مفصولة بفاصلة', hidden: true, 'aria-label': 'الاختيارات' });
  typeSel.onchange = () => { choicesIn.hidden = typeSel.value !== 'choices'; };
  const compose = h('div', { class: 'card' }, h('h2', {}, 'اكتب للمريض'), txt,
    h('div', { class: 'row-actions' }, h('button', { class: 'btn secondary', type: 'button', onclick: async () => {
      if (!txt.value.trim()) return toast('اكتب نصًا أولًا.', 'error');
      try { await Rooms.post(id, 'staff', { type: 'text', text: txt.value.trim() }); txt.value = ''; toast('أُرسلت الرسالة.', 'success', 2500); } catch { toast('تعذّر الإرسال.', 'error'); }
    } }, '📨 إرسال كرسالة')),
    h('label', { class: 'field' }, 'أو أرسله كسؤال والمريض يجيب بـ:', typeSel), choicesIn,
    h('button', { class: 'btn primary block', type: 'button', onclick: async () => {
      const text = txt.value.trim(); if (!text) return toast('اكتب السؤال أولًا.', 'error');
      const choices = choicesIn.value.split(/[,،]/).map(x => x.trim()).filter(Boolean);
      if (typeSel.value === 'choices' && choices.length < 2) return toast('اكتب اختيارين على الأقل.', 'error');
      await sendQuestion({ text, answerType: typeSel.value, choices }); txt.value = ''; choicesIn.value = '';
    } }, '❓ إرسال كسؤال'));

  /* بنك الأسئلة الجاهزة */
  const q = h('input', { class: 'input', type: 'search', placeholder: 'ابحث في الأسئلة…', 'aria-label': 'بحث في الأسئلة' });
  let cat = '';
  const catBox = h('div', { class: 'chips' }); const qList = h('div', { class: 'list scroll' });
  const drawBank = () => {
    catBox.replaceChildren(...[{ id: '', title: 'الكل' }, ...c.categories].map(k => h('button', { class: 'chip btn-chip' + (cat === k.id ? ' sel' : ''), type: 'button', 'aria-pressed': cat === k.id, onclick: () => { cat = k.id; drawBank(); } }, k.title)));
    const t = q.value.trim();
    const items = c.questions.filter(x => (!cat || x.catId === cat) && (!t || x.text.includes(t)));
    qList.replaceChildren(...(items.length ? items.map(x => h('div', { class: 'row' },
      h('span', { class: 'row-main' }, h('strong', { dir: 'auto' }, x.text), h('small', {}, ANSWER_TYPES[x.answerType])),
      h('button', { class: 'btn primary', type: 'button', onclick: () => sendQuestion(x) }, 'إرسال'))) : [h('p', { class: 'empty' }, 'لا توجد أسئلة مطابقة.')]));
  };
  q.oninput = drawBank; drawBank();
  const bank = h('div', { class: 'card' }, h('h2', {}, 'أسئلة جاهزة'), q, catBox, qList);

  unsub = subscribe(() => Rooms.get(id, 'staff'), (room, err) => {
    if (err) {
      if (err.status === 401) { Session.clear(); toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error'); return go('/login/staff/' + id); }
      if (err.status === 404) { toast('هذه المقابلة غير موجودة أو انتهت.', 'error'); return go('/staff'); }
      return helpBox.replaceChildren(h('div', { class: 'alert warn' }, '⚠️ انقطع الاتصال. سنعيد المحاولة.'));
    }
    notifyHelp([{ id: room.id, helpAt: room.helpAt }]);
    head.replaceChildren(h('strong', {}, 'مقابلة ' + room.code + (room.alias ? ' — ' + room.alias : '')),
      h('div', { class: 'row-actions' },
        h('a', { class: 'btn ghost', href: '#/staff' }, '← كل المقابلات'),
        h('button', { class: 'btn ghost', type: 'button', onclick: async () => { if (await confirmBox('سيتم إنهاء المقابلة وحذف رسائلها. متابعة؟', 'إنهاء المقابلة')) { await Rooms.remove(id, 'staff').catch(() => {}); go('/staff'); } } }, 'إنهاء المقابلة')));
    helpBox.replaceChildren(...(room.helpAt ? [h('div', { class: 'alert urgent flash', role: 'alert' }, h('strong', {}, '🆘 المريض يطلب المساعدة الآن'),
      h('button', { class: 'btn primary', type: 'button', onclick: async () => { await Rooms.post(id, 'staff', { type: 'ack' }); toast('أُرسل للمريض أنك استلمت طلبه.', 'success'); } }, '✓ تم استلام الطلب'))] : []));
    // ملخص المريض
    const p = room.patient;
    const urgent = p && (p.symptoms.filter(s => s.urgent === 'always' || (s.urgent === 'severe' && s.severity === 3)).map(s => s.name)
      .concat(p.pains.filter(x => x.part === 'chest' && x.severity === 3).map(() => 'ألم شديد في الصدر')));
    sumBox.replaceChildren(h('h2', {}, 'ما أبلغ عنه المريض'),
      !room.shared ? h('p', { class: 'note' }, 'لم يوافق المريض على مشاركة أعراضه بعد.') : [
        urgent.length > 0 && h('div', { class: 'alert urgent' }, '⚠️ اختار المريض: ' + [...new Set(urgent)].join('، ') + ' — يستدعي الانتباه فورًا.'),
        h('div', { class: 'chips big' }, p.symptoms.map(s => h('span', { class: 'chip sev' + s.severity }, s.name + (s.severity ? ' — ' + SEVERITY[s.severity] : ' — لم يحدد الشدة'))),
          p.pains.map(x => h('span', { class: 'chip sev' + x.severity }, 'ألم: ' + x.label + ' — ' + SEVERITY[x.severity]))),
        !p.symptoms.length && !p.pains.length && h('p', { class: 'note' }, 'لم يختر المريض أعراضًا.'),
        h('p', { class: 'note' }, 'هذه بيانات أبلغ بها المريض بنفسه وليست تشخيصًا.')]);
    thread.replaceChildren(h('h2', {}, 'المحادثة'), renderThread(room, { who: 'staff' }));
  });
  return { title: 'مقابلة مريض', back: '/staff', noFab: true, cleanup: () => { unsub?.(); stopFlash(); }, el: h('div', {}, head, helpBox, sumBox, thread, compose, bank) };
}
