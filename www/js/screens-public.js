// الشاشات العامة: الرئيسية، التعليمات، المساعدة، مكتبة الفيديو، الإعدادات.
import { h, toast, iconEl, badge, videoBadge, videoPlayer, showBig, confirmBox, pic } from './ui.js';
import { content, byId, videoSource, downloadVideo, clearProbe } from './db.js';
import { Net, detectServer } from './rooms.js';
import { Settings, Patient } from './state.js';
import { Direct } from './direct.js';
import { ICONS, icon } from './icons.js';
import { myRequests, Requests } from './requests.js';

export const ic = name => h('span', { html: icon(name), style: 'display:contents' });
export const tile = ({ icon: ico, title, sub, cls = '', href, onclick }) =>
  h(href ? 'a' : 'button', { class: 'tile ' + cls, href: href ? '#' + href : null, type: href ? null : 'button', onclick },
    h('span', { class: 'tile-icon', 'aria-hidden': 'true', html: ICONS[ico] ? icon(ico) : null }, ICONS[ico] ? null : ico),
    h('span', { class: 'tile-text' }, h('strong', {}, title), sub && h('small', {}, sub)),
    h('span', { class: 'tile-go', html: icon('chevron-left') }));
/** بطاقة بصورة كبيرة — الأساس في واجهة سهلة للصم. */
export const picTile = ({ pic: p, title, sub, href, onclick, tone = 'teal', wide = false }) =>
  h(href ? 'a' : 'button', { class: `ptile tone-${tone}${wide ? ' wide' : ''}`, href: href ? '#' + href : null, type: href ? null : 'button', onclick },
    h('span', { class: 'ptile-pic' }, pic(p)),
    h('span', { class: 'ptile-text' }, h('strong', {}, title), sub && h('small', {}, sub)));
export const footLinks = () => h('nav', { class: 'foot-links', 'aria-label': 'روابط' },
  h('a', { href: '#/about' }, 'عن التطبيق'), h('a', { href: '#/contact' }, 'اتصل بنا'), h('a', { href: '#/howto' }, 'كيفية الاستخدام'));

export function netBadge() {
  if (Net.mode === 'local' && Direct.patientConnected()) return badge('🟢 متصل مباشرة بهاتف الطبيب/الممرض', 'ok');
  if (Net.mode === 'local' && Direct.staffCount()) return badge(`🟢 مرتبط مباشرة بـ ${Direct.staffCount()} هاتف مريض`, 'ok');
  return Net.mode === 'server'
    ? badge('🟢 متصل بنظام المستشفى', 'ok')
    : badge('🟠 هذا الهاتف فقط — غير متصل بنظام المستشفى', 'warn');
}

/* ---------- الرئيسية ---------- */
export function home(_, app) {
  return {
    title: 'طبيبي يفهمني', sub: 'Tabibi Yefhamni · تواصل مع طبيبك بلغتك', home: true, noFab: true,
    el: h('div', {},
      h('div', { class: 'hero' },
        h('div', { class: 'hero-art', 'aria-hidden': 'true' },
          pic('person-deaf', 'ha-a'), pic('speech-balloon', 'ha-b'), pic('health-worker', 'ha-c')),
        h('p', { class: 'eyebrow' }, 'لمرضى الصم وضعاف السمع'),
        h('h1', {}, 'اشرح لطبيبك ما تشعر به — بالصور والإشارة والكتابة.'),
        h('p', { class: 'lead' }, 'اختر صورة العَرَض، وحدّد مكان الألم، أو سجّل شكواك بلغة الإشارة. يظهر كل شيء للطبيب بالعربية.'),
        h('a', { class: 'btn primary block big-cta', href: '#/patient' }, pic('person-raising-hand', 'btn-pic'), 'ابدأ الآن كمريض'),
        h('div', {}, netBadge())),
      h('button', { class: 'help-card', type: 'button', onclick: () => app.helpNow() },
        pic('sos-button', 'help-pic'),
        h('span', {}, h('strong', {}, 'أحتاج مساعدة الآن'), h('small', {}, 'رسالة كبيرة حمراء تُريها للطبيب أو الممرض'))),
      h('h2', { class: 'section-title' }, 'اختر ما تريد'),
      h('div', { class: 'pgrid' },
        picTile({ pic: 'person-raising-hand', title: 'أنا مريض', sub: 'أعراضي ورسالتي للطبيب', href: '/patient', tone: 'teal', wide: true }),
        picTile({ pic: 'face-with-thermometer', title: 'الأعراض بالصور', sub: 'اضغط على صورة العَرَض', href: '/symptoms', tone: 'amber' }),
        picTile({ pic: 'video-camera', title: 'شكوى بالإشارة', sub: 'فيديو يترجمه مترجم', href: '/complaint', tone: 'blue' }),
        picTile({ pic: 'person-deaf', title: 'فيديوهات الإشارة', sub: 'مكتبة حسب الموضوع', href: '/signs', tone: 'teal' }),
        picTile({ pic: 'spiral-calendar', title: 'موعد ومترجم', sub: 'مترجم يرافقك للعيادة', href: '/appointment', tone: 'rose' }),
        picTile({ pic: 'megaphone', title: 'الحملات', sub: 'تطعيم وتوعية', href: '/campaigns', tone: 'amber' }),
        picTile({ pic: 'open-book', title: 'كيف أستخدمه؟', sub: 'خطوات بالصور', href: '/howto', tone: 'blue' }),
        picTile({ pic: 'health-worker', title: 'أنا طبيب أو ممرض', sub: 'بتسجيل دخول', href: '/login/staff', tone: 'gray' }),
        picTile({ pic: 'handshake', title: 'أنا مترجم إشارة', sub: 'بوابة المترجمين', href: '/login/interpreter', tone: 'gray' })),
      h('div', { class: 'info-card' }, pic('mobile-phone', 'info-pic'),
        h('span', {}, 'الأعراض والأسئلة والصور تعمل دون إنترنت بعد فتح التطبيق مرة واحدة. الرسائل وتنبيه الطبيب تعمل بالربط المباشر بين الهاتفين أو عبر خادم المستشفى.')),
      h('p', { class: 'disclaimer' }, 'هذا التطبيق أداة تواصل ومساعدة فقط. لا يقدّم تشخيصًا طبيًا ولا يصف علاجًا أو جرعات دوائية، ولا يغني عن مترجم لغة الإشارة عند توفره.'),
      footLinks(),
      h('p', { class: 'foot-links', style: 'border:0;margin-top:0' },
        h('a', { href: '#/login/admin' }, 'إدارة المحتوى'), h('a', { href: '#/requests' }, 'طلباتي')))
  };
}

/* ---------- كيفية الاستخدام ---------- */
export function howto() {
  const steps = [
    ['اضغط «أنا مريض».', 'ستجد كل ما تحتاجه لتوضيح حالتك.', 'person-raising-hand'],
    ['اختر الأعراض بالصور.', 'اضغط على الصورة المناسبة، ثم اختر الشدة: خفيف، متوسط، شديد.', 'face-with-thermometer'],
    ['حدّد مكان الألم.', 'اضغط على مكان الألم في صورة الجسم، ثم اختر شدته.', 'round-pushpin'],
    ['ابدأ المقابلة.', 'سيظهر رمز من 4 أرقام. أعطِ الرمز للطبيب أو الممرض ليفتح مقابلتك.', 'speech-balloon'],
    ['وافق على المشاركة إن أردت.', 'لا يرى الطبيب أعراضك إلا إذا ضغطت «أوافق على مشاركة أعراضي».', 'check-mark-button'],
    ['اقرأ أسئلة الطبيب وأجب.', 'يظهر السؤال مكتوبًا ومعه فيديو الإشارة إن توفر. اضغط صورة: نعم أو لا أو لا أعرف.', 'thinking-face'],
    ['عند الحاجة اضغط «أحتاج مساعدة الآن».', 'يظهر لك تنبيه كبير يمكنك إظهاره لأي طبيب أو ممرض.', 'sos-button']
  ];
  return {
    title: 'كيفية استخدام التطبيق',
    el: h('div', {},
      h('ol', { class: 'steps pic-steps' }, steps.map(([t, d, p]) => h('li', {}, pic(p, 'step-pic'), h('div', {}, h('strong', {}, t), h('span', {}, d))))),
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
  const phrases = [['أحتاج مساعدة', 'o6', 'folded-hands', 'teal'], ['أحتاج مترجم لغة إشارة', 'o7', 'person-deaf', 'blue'], ['طوارئ! أحتاج طبيبًا الآن', 'e4', 'ambulance', 'rose'],
    ['أشعر بألم شديد', 'p5', 'tired-face', 'amber'], ['أحتاج دورة المياه', null, 'toilet', 'blue'], ['أحتاج ماء', null, 'cup-with-straw', 'teal'],
    ['لم أفهم، اكتب لي من فضلك', null, 'writing-hand', 'amber'], ['أريد أن أرى الطبيب', null, 'health-worker', 'gray']];
  const c = content();
  return {
    title: 'طلب المساعدة', noFab: true,
    el: h('div', {},
      h('button', { class: 'btn danger giant', type: 'button', onclick: () => app.helpNow() }, pic('sos-button', 'btn-pic big'), 'أحتاج مساعدة الآن'),
      h('p', { class: 'note' }, 'يعرض الزر رسالة كبيرة تطلب حضور الطبيب أو الممرض. يصل تنبيه فعلي لهاتف الطبيب إذا كان هاتفك مرتبطًا به مباشرة أو متصلًا بنظام المستشفى.'),
      h('h2', {}, 'جمل سريعة للإظهار'),
      h('p', { class: 'note' }, 'اضغط على الجملة لتظهر بخط كبير، وأرِ الشاشة للشخص أمامك.'),
      h('div', { class: 'pgrid' }, phrases.map(([t, sid, p, tone]) =>
        picTile({ pic: p, title: t, tone, onclick: () => showBig({ text: t, image: p, sign: sid ? byId(c.signs, sid) : null, danger: sid === 'e4' }) }))))
  };
}

/* ---------- مكتبة الفيديو ---------- */
export function signsHome() {
  const c = content();
  const grid = h('div', { class: 'pgrid' });
  c.categories.forEach(cat => {
    const list = c.signs.filter(s => s.catId === cat.id);
    const sub = h('small', {}, `${list.length} جملة/كلمة`);
    Promise.all(list.map(videoSource)).then(r => { sub.textContent = `${list.length} جملة/كلمة — ${r.filter(Boolean).length} فيديو متوفر`; });
    grid.append(h('a', { class: 'ptile tone-teal', href: '#/signs/' + cat.id },
      h('span', { class: 'ptile-pic' }, iconEl(cat.icon)), h('span', { class: 'ptile-text' }, h('strong', {}, cat.title), sub)));
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

  const wipe = h('button', { class: 'btn danger block', type: 'button' }, ic('trash-2'), 'حذف كل بياناتي');
  wipe.onclick = async () => {
    if (!await confirmBox('سيتم حذف الأعراض والمقابلة، وفيديوهات الشكاوى وطلبات المواعيد التي أرسلتها من هذا الهاتف (ومن الخادم إن كانت أُرسلت إليه). هل أنت متأكد؟', 'حذف كل شيء')) return;
    let failed = 0;
    for (const ref of myRequests.all()) { try { await Requests.remove(ref); } catch (e) { if (e.status !== 404) failed++; } }
    if (!failed) myRequests.clear();
    Patient.clear();
    toast(failed ? `حُذفت بياناتك من الهاتف، وتعذّر حذف ${failed} طلب من الخادم. حاول مرة أخرى عند الاتصال.` : 'تم حذف كل بياناتك.', failed ? 'error' : 'success', 7000);
  };

  return {
    title: 'حسابي', sub: 'الإعدادات والخصوصية',
    el: h('div', {},
      status,
      h('div', { class: 'card' }, h('h2', {}, 'عنوان خادم المستشفى'), h('label', { class: 'field' }, 'العنوان (يضعه مسؤول النظام)', url), save),
      h('div', { class: 'card' }, h('h2', {}, 'العمل دون إنترنت'),
        h('p', { class: 'note' }, 'الأسئلة والأعراض والصور محفوظة في التطبيق. فيديوهات الإشارة تعمل دون إنترنت إذا كانت داخل التطبيق أو إذا حفظتها على الهاتف.'), dlAll),
      h('div', { class: 'card' }, h('h2', {}, 'الحساب'), h('p', { class: 'note' }, 'تستخدم التطبيق بدون حساب. بياناتك مرتبطة بهذا الهاتف فقط، ولا تُربط باسم أو بريد. لا تُشارَك إلا بموافقتك.'),
        h('a', { class: 'btn secondary block', href: '#/requests' }, ic('list'), `طلباتي (${myRequests.all().length})`)),
      h('div', { class: 'card' }, h('h2', {}, 'حذف بياناتي'), h('p', { class: 'note' }, 'يشمل الحذف الأعراض والمقابلة وفيديوهات الشكاوى والردود وطلبات المواعيد المرتبطة بهذا الهاتف.'), wipe),
      footLinks())
  };
}

export function notFound() {
  return { title: 'غير موجود', el: h('div', { class: 'empty' }, h('p', {}, 'الصفحة المطلوبة غير موجودة.'), h('a', { class: 'btn primary', href: '#/' }, 'الرئيسية')) };
}
