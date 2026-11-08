// الشاشات العامة: الرئيسية، التعليمات، المساعدة، مكتبة الفيديو، الإعدادات.
import { h, toast, iconEl, badge, videoBadge, videoPlayer, showBig, confirmBox } from './ui.js';
import { content, byId, videoSource, downloadVideo, clearProbe } from './db.js';
import { Net, detectServer } from './rooms.js';
import { Settings, Patient } from './state.js';
import { Direct } from './direct.js';

export const tile = ({ icon, title, sub, cls = '', href, onclick }) =>
  h(href ? 'a' : 'button', { class: 'tile ' + cls, href: href ? '#' + href : null, type: href ? null : 'button', onclick },
    h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'tile-text' }, h('strong', {}, title), sub && h('small', {}, sub)));

export function netBadge() {
  if (Net.mode === 'local' && Direct.patientConnected()) return badge('🟢 متصل مباشرة بهاتف الطبيب/الممرض', 'ok');
  if (Net.mode === 'local' && Direct.staffCount()) return badge(`🟢 مرتبط مباشرة بـ ${Direct.staffCount()} هاتف مريض`, 'ok');
  return Net.mode === 'server'
    ? badge('🟢 متصل بنظام المستشفى', 'ok')
    : badge('🟠 هذا الهاتف فقط — غير متصل بنظام المستشفى', 'warn');
}

/* ---------- الرئيسية ---------- */
export function home() {
  return {
    title: 'طبيبي يفهمني', home: true, noFab: false,
    el: h('div', {},
      h('div', { class: 'hero' },
        h('div', { class: 'logo', 'aria-hidden': 'true' }, '🩺'),
        h('h1', {}, 'طبيبي يفهمني'),
        h('p', { class: 'lead' }, 'Tabibi Yefhamni — لمساعدة المرضى الصم وضعاف السمع على التواصل مع الأطباء والممرضين.'),
        h('div', {}, netBadge())),
      h('div', { class: 'tiles' },
        tile({ icon: '🙋', title: 'أنا مريض', sub: 'اختر الأعراض وتواصل مع الطبيب', cls: 'primary', href: '/patient' }),
        tile({ icon: '👨‍⚕️', title: 'أنا طبيب أو ممرض', sub: 'يتطلب تسجيل دخول', cls: 'blue', href: '/login/staff' }),
        tile({ icon: '🤟', title: 'فيديوهات لغة الإشارة', sub: 'مكتبة مرتبة حسب الموضوع', href: '/signs' }),
        tile({ icon: '🖼️', title: 'الأعراض بالصور', sub: 'اضغط على الصورة المناسبة', href: '/symptoms' }),
        tile({ icon: '🆘', title: 'طلب المساعدة', sub: 'أحتاج مساعدة الآن', cls: 'danger', href: '/help' }),
        tile({ icon: '📖', title: 'كيفية استخدام التطبيق', sub: 'خطوات بسيطة مكتوبة', href: '/howto' })),
      h('p', { class: 'foot-links' },
        h('a', { href: '#/login/admin' }, '⚙️ إدارة المحتوى'), ' · ', h('a', { href: '#/settings' }, '🔧 الإعدادات والاتصال')),
      h('p', { class: 'disclaimer' }, 'هذا التطبيق وسيلة مساعدة على التواصل فقط. لا يقدّم تشخيصًا ولا علاجًا ولا جرعات دوائية، ولا يغني عن مترجم لغة الإشارة عند توفره.'))
  };
}

/* ---------- كيفية الاستخدام ---------- */
export function howto() {
  const steps = [
    ['اضغط «أنا مريض».', 'ستجد كل ما تحتاجه لتوضيح حالتك.'],
    ['اختر الأعراض بالصور.', 'اضغط على الصورة المناسبة، ثم اختر الشدة: خفيف، متوسط، شديد.'],
    ['حدّد مكان الألم.', 'اضغط على مكان الألم في صورة الجسم، ثم اختر شدته.'],
    ['ابدأ المقابلة.', 'سيظهر رمز من 4 أرقام. أعطِ الرمز للطبيب أو الممرض ليفتح مقابلتك.'],
    ['وافق على المشاركة إن أردت.', 'لا يرى الطبيب أعراضك إلا إذا ضغطت «أوافق على مشاركة أعراضي».'],
    ['اقرأ أسئلة الطبيب وأجب.', 'يظهر السؤال مكتوبًا، ومعه فيديو الإشارة إن كان متوفرًا. اضغط نعم أو لا أو لا أعرف.'],
    ['عند الحاجة اضغط «أحتاج مساعدة الآن».', 'يظهر لك تنبيه كبير يمكنك إظهاره لأي طبيب أو ممرض.']
  ];
  return {
    title: 'كيفية استخدام التطبيق',
    el: h('div', {},
      h('ol', { class: 'steps' }, steps.map(([t, d]) => h('li', {}, h('strong', {}, t), h('span', {}, d)))),
      h('div', { class: 'card' },
        h('h2', {}, 'مهم أن تعرف'),
        h('ul', { class: 'plain' },
          h('li', {}, 'الأعراض والأسئلة والصور تعمل دون إنترنت بعد فتح التطبيق مرة واحدة.'),
          h('li', {}, 'الرسائل بين هاتف المريض وهاتف الطبيب تعمل دون إنترنت عبر «الربط المباشر»: الهاتفان على نفس الواي فاي، أو يفتح أحدهما نقطة اتصال ويتصل بها الآخر، ثم يمسح كل منهما رمز الآخر.'),
          h('li', {}, 'إذا لم توجد أي شبكة بين الهاتفين: أرِ شاشة هاتفك للطبيب، أو سلّمه الهاتف ليسجّل دخوله ويسألك عليه.'),
          h('li', {}, 'التطبيق لا يشخّص المرض ولا يصف علاجًا.'))),
      h('a', { class: 'btn primary block', href: '#/patient' }, 'ابدأ الآن'))
  };
}

/* ---------- طلب المساعدة ---------- */
export function help(_, app) {
  const phrases = [['أحتاج مساعدة', 'o6'], ['أحتاج مترجم لغة إشارة', 'o7'], ['طوارئ! أحتاج طبيبًا الآن', 'e4'],
    ['أشعر بألم شديد', 'p5'], ['أحتاج دورة المياه', null], ['أحتاج ماء', null], ['لم أفهم، اكتب لي من فضلك', null]];
  const c = content();
  return {
    title: 'طلب المساعدة', noFab: true,
    el: h('div', {},
      h('button', { class: 'btn danger giant', type: 'button', onclick: () => app.helpNow() }, '🆘 أحتاج مساعدة الآن'),
      h('p', { class: 'note' }, 'يعرض الزر رسالة كبيرة تطلب حضور الطبيب أو الممرض. يصل تنبيه فعلي لهاتف الطبيب إذا كان هاتفك مرتبطًا به مباشرة أو متصلًا بنظام المستشفى.'),
      h('h2', {}, 'جمل سريعة للإظهار'),
      h('p', { class: 'note' }, 'اضغط على الجملة لتظهر بخط كبير، وأرِ الشاشة للشخص أمامك.'),
      h('div', { class: 'tiles' }, phrases.map(([t, sid]) =>
        tile({ icon: '💬', title: t, onclick: () => showBig({ text: t, sign: sid ? byId(c.signs, sid) : null, danger: sid === 'e4' }) }))))
  };
}

/* ---------- مكتبة الفيديو ---------- */
export function signsHome() {
  const c = content();
  const grid = h('div', { class: 'tiles' });
  c.categories.forEach(cat => {
    const list = c.signs.filter(s => s.catId === cat.id);
    const sub = h('small', {}, `${list.length} جملة/كلمة`);
    Promise.all(list.map(videoSource)).then(r => { sub.textContent = `${list.length} جملة/كلمة — ${r.filter(Boolean).length} فيديو متوفر`; });
    grid.append(h('a', { class: 'tile', href: '#/signs/' + cat.id },
      h('span', { class: 'tile-icon' }, iconEl(cat.icon)), h('span', { class: 'tile-text' }, h('strong', {}, cat.title), sub)));
  });
  return {
    title: 'فيديوهات لغة الإشارة',
    el: h('div', {}, h('p', { class: 'note' }, 'اختر موضوعًا. إذا لم يتوفر فيديو سترى النص المكتوب مع رسالة «الفيديو غير متوفر حاليًا».'), grid)
  };
}

export function signsCategory({ id }) {
  const c = content(); const cat = byId(c.categories, id);
  if (!cat) return notFound();
  const q = h('input', { type: 'search', placeholder: 'ابحث في هذا الموضوع…', 'aria-label': 'بحث', class: 'input' });
  const list = h('div', { class: 'list' });
  const draw = () => {
    const t = q.value.trim();
    const items = c.signs.filter(s => s.catId === id && (!t || s.text.includes(t)));
    list.replaceChildren(...(items.length ? items.map(s => h('a', { class: 'row', href: '#/sign/' + s.id },
      h('span', { class: 'row-main' }, h('strong', {}, s.text), h('small', {}, s.desc || cat.desc || '')), videoBadge(s))) : [h('p', { class: 'empty' }, 'لا توجد نتائج.')]));
  };
  q.oninput = draw; draw();
  return { title: cat.title, back: '/signs', el: h('div', {}, q, list) };
}

export function signPage({ id }) {
  const c = content(); const s = byId(c.signs, id);
  if (!s) return notFound();
  const cat = byId(c.categories, s.catId);
  const sibs = c.signs.filter(x => x.catId === s.catId); const i = sibs.indexOf(s);
  const nav = h('div', { class: 'row-actions' },
    sibs[i - 1] && h('a', { class: 'btn secondary', href: '#/sign/' + sibs[i - 1].id }, '→ السابق'),
    sibs[i + 1] && h('a', { class: 'btn secondary', href: '#/sign/' + sibs[i + 1].id }, 'التالي ←'));
  return {
    title: cat?.title || 'إشارة', back: '/signs/' + s.catId,
    el: h('div', {},
      h('h2', { class: 'sign-title' }, s.text),
      h('p', { class: 'note' }, s.desc || cat?.desc || ''),
      videoPlayer(s), h('div', {}, videoBadge(s)), nav)
  };
}

/* ---------- الإعدادات ---------- */
export function settings(_, app) {
  const status = h('div', { class: 'card' });
  const drawStatus = () => status.replaceChildren(h('h2', {}, 'حالة الاتصال'), netBadge(),
    h('p', { class: 'note' }, Net.mode === 'server'
      ? 'تُرسل الرسائل عبر الخادم: ' + (Net.base || location.origin)
      : 'بدون خادم: استخدم «الربط المباشر» من صفحة المقابلة لربط هاتف المريض بهاتف الطبيب على نفس الواي فاي أو نقطة اتصال، دون إنترنت. أو اكتب عنوان خادم المستشفى أدناه.'));
  drawStatus();
  const url = h('input', { class: 'input', type: 'url', dir: 'ltr', placeholder: 'http://192.168.1.10:3000', value: Settings.serverUrl, 'aria-label': 'عنوان الخادم' });
  const save = h('button', { class: 'btn primary', type: 'button' }, 'حفظ واختبار الاتصال');
  save.onclick = async () => {
    Settings.serverUrl = url.value.trim();
    save.disabled = true; save.textContent = 'جارٍ الاختبار…';
    const prev = Net.mode;
    await detectServer();
    save.disabled = false; save.textContent = 'حفظ واختبار الاتصال';
    if (prev !== Net.mode) Patient.resetRoom();
    drawStatus(); app.refreshNet?.();
    if (Net.mode === 'server') toast('تم الاتصال بالخادم بنجاح.', 'success');
    else toast(Settings.serverUrl ? 'تعذّر الوصول إلى الخادم. تأكد من العنوان ومن اتصال الشبكة.' : 'تم الرجوع إلى الوضع المحلي.', Settings.serverUrl ? 'error' : 'info');
  };

  const dlAll = h('button', { class: 'btn secondary', type: 'button' }, '⬇ حفظ كل الفيديوهات المتاحة على الهاتف');
  dlAll.onclick = async () => {
    dlAll.disabled = true; let ok = 0, fail = 0, none = 0;
    clearProbe();
    for (const s of content().signs) {
      const src = await videoSource(s);
      if (!src) { none++; continue; }
      try { await downloadVideo(s); ok++; } catch { fail++; }
    }
    dlAll.disabled = false;
    toast(`تم حفظ/تأكيد ${ok} فيديو. غير متوفر: ${none}. فشل: ${fail}.`, fail ? 'error' : 'success', 7000);
  };

  const wipe = h('button', { class: 'btn danger', type: 'button' }, '🗑 مسح بياناتي من هذا الهاتف');
  wipe.onclick = async () => {
    if (await confirmBox('سيتم مسح الأعراض والمقابلة المحفوظة على هذا الهاتف. هل أنت متأكد؟')) {
      Patient.clear(); toast('تم مسح بياناتك من هذا الهاتف.', 'success');
    }
  };

  return {
    title: 'الإعدادات والاتصال',
    el: h('div', {},
      status,
      h('div', { class: 'card' }, h('h2', {}, 'عنوان خادم المستشفى'), h('label', { class: 'field' }, 'العنوان (يضعه مسؤول النظام)', url), save),
      h('div', { class: 'card' }, h('h2', {}, 'العمل دون إنترنت'),
        h('p', { class: 'note' }, 'الأسئلة والأعراض والصور محفوظة في التطبيق. فيديوهات الإشارة تعمل دون إنترنت إذا كانت داخل التطبيق أو إذا حفظتها على الهاتف.'), dlAll),
      h('div', { class: 'card' }, h('h2', {}, 'خصوصيتك'), h('p', { class: 'note' }, 'لا يطلب التطبيق اسمك الحقيقي ولا رقمك. تبقى بياناتك على هذا الهاتف ولا تُشارَك إلا بموافقتك.'), wipe))
  };
}

export function notFound() {
  return { title: 'غير موجود', el: h('div', { class: 'empty' }, h('p', {}, 'الصفحة المطلوبة غير موجودة.'), h('a', { class: 'btn primary', href: '#/' }, 'الرئيسية')) };
}
