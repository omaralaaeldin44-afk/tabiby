// لوحة إدارة المحتوى: فيديوهات/جمل، أسئلة، أعراض، تصنيفات، أدوات.
import { h, toast, modal, confirmBox, iconEl, videoBadge, videoPlayer, badge } from './ui.js';
import { content, saveContent, byId, uid, Media, clearProbe, resetContent, replaceContent, videoSource } from './db.js';
import { Session } from './state.js';
import { ANSWER_TYPES } from './seed.js';

const save = () => { if (!saveContent()) toast('تعذّر الحفظ: مساحة التخزين ممتلئة.', 'error'); };

/** نافذة نموذج عامة. fields: {name,label,type,options,hint,required,accept} */
function formModal({ title, fields, values = {}, onSave }) {
  const inputs = {};
  const err = h('div', { class: 'alert urgent', role: 'alert', hidden: true });
  const body = h('form', { novalidate: true, onsubmit: e => e.preventDefault() }, fields.map(f => {
    let el;
    if (f.type === 'textarea') el = h('textarea', { class: 'input', rows: '3' }, values[f.name] || '');
    else if (f.type === 'select') { el = h('select', { class: 'input' }, f.options.map(o => h('option', { value: o.v, selected: o.v === (values[f.name] ?? '') }, o.l))); }
    else if (f.type === 'checkbox') { el = h('input', { type: 'checkbox', class: 'check' }); el.checked = !!values[f.name]; }
    else if (f.type === 'file') el = h('input', { type: 'file', class: 'input', accept: f.accept || '' });
    else { el = h('input', { class: 'input', value: values[f.name] ?? '' }); if (f.dir) el.dir = f.dir; }
    inputs[f.name] = el;
    return h('label', { class: 'field' + (f.type === 'checkbox' ? ' inline' : '') }, f.label + (f.required ? ' *' : ''), el, f.hint && h('small', {}, f.hint));
  }), err);
  modal({
    title, body, wide: true,
    actions: [{
      label: 'حفظ', cls: 'primary', onclick: async () => {
        const out = {};
        for (const f of fields) {
          const el = inputs[f.name];
          out[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'file' ? (el.files[0] || null) : el.value.trim();
          if (f.required && !out[f.name]) { err.hidden = false; err.textContent = 'الحقل مطلوب: ' + f.label; el.focus(); return false; }
        }
        try { await onSave(out); } catch (e) { err.hidden = false; err.textContent = e.message || 'تعذّر الحفظ'; return false; }
      }
    }, { label: 'إلغاء' }]
  });
}

const catOptions = (c, withNone) => [...(withNone ? [{ v: '', l: '— بلا —' }] : []), ...c.categories.map(k => ({ v: k.id, l: k.title }))];
const signOptions = c => [{ v: '', l: '— بلا فيديو —' }, ...c.signs.map(s => ({ v: s.id, l: s.text }))];

/* ---------- تبويب الفيديوهات والجمل ---------- */
function tabSigns() {
  const c = content();
  const q = h('input', { class: 'input', type: 'search', placeholder: 'ابحث…', 'aria-label': 'بحث' });
  const catSel = h('select', { class: 'input', 'aria-label': 'تصنيف' }, catOptions(c, true).map(o => h('option', { value: o.v }, o.v ? o.l : 'كل التصنيفات')));
  const list = h('div', { class: 'list' });

  const edit = sign => {
    const isNew = !sign; const s = sign || { id: uid('s'), catId: c.categories[0]?.id, text: '', desc: '', file: '', url: '' };
    const hasLocal = Media.hasVideo(s.id);
    formModal({
      title: isNew ? 'إضافة كلمة/جملة' : 'تعديل: ' + s.text, values: s,
      fields: [
        { name: 'text', label: 'الكلمة أو الجملة بالعربية', required: true },
        { name: 'catId', label: 'التصنيف', type: 'select', options: catOptions(c), required: true },
        { name: 'desc', label: 'وصف بسيط', type: 'textarea' },
        { name: 'file', label: 'مسار ملف الفيديو داخل التطبيق', dir: 'ltr', hint: 'مثال: videos/' + s.id + '.mp4 — ضع الملف في مجلد www/videos قبل بناء التطبيق.' },
        { name: 'url', label: 'أو رابط فيديو (اختياري)', dir: 'ltr', hint: 'رابط مباشر لملف mp4/webm يسمح بالتحميل.' },
        { name: 'video', label: 'أو ارفع فيديو من هذا الهاتف' + (hasLocal ? ' (يوجد فيديو محفوظ — الرفع يستبدله)' : ''), type: 'file', accept: 'video/*' },
        ...(hasLocal ? [{ name: 'rm', label: 'حذف الفيديو المحفوظ على الهاتف', type: 'checkbox' }] : [])
      ],
      onSave: async o => {
        Object.assign(s, { text: o.text, catId: o.catId, desc: o.desc, file: o.file, url: o.url });
        if (o.rm) await Media.del('v:' + s.id);
        if (o.video) { if (!o.video.type.startsWith('video/')) throw new Error('الملف المختار ليس فيديو.'); await Media.put('v:' + s.id, o.video); }
        if (isNew) c.signs.push(s);
        clearProbe(); save(); toast('تم الحفظ.', 'success'); draw();
      }
    });
  };
  const del = async s => {
    if (!await confirmBox(`حذف «${s.text}»؟ ستُفصل الأسئلة والأعراض المرتبطة به عن الفيديو.`)) return;
    c.signs = c.signs.filter(x => x !== s);
    c.questions.forEach(x => { if (x.signId === s.id) x.signId = ''; });
    c.symptoms.forEach(x => { if (x.signId === s.id) x.signId = ''; });
    await Media.del('v:' + s.id); save(); toast('تم الحذف.', 'success'); draw();
  };
  const draw = () => {
    const t = q.value.trim();
    const items = c.signs.filter(s => (!catSel.value || s.catId === catSel.value) && (!t || s.text.includes(t)));
    list.replaceChildren(...(items.length ? items.map(s => h('div', { class: 'row wrap' },
      h('span', { class: 'row-main' }, h('strong', { dir: 'auto' }, s.text), h('small', {}, byId(c.categories, s.catId)?.title || 'بلا تصنيف')), videoBadge(s),
      h('span', { class: 'row-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => modal({ title: s.text, body: videoPlayer(s), actions: [{ label: 'إغلاق', cls: 'primary' }] }) }, '▶ معاينة'),
        h('button', { class: 'btn secondary', type: 'button', onclick: () => edit(s) }, 'تعديل'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => del(s) }, 'حذف')))) : [h('p', { class: 'empty' }, 'لا توجد عناصر.')]));
  };
  q.oninput = draw; catSel.onchange = draw; draw();
  return h('div', {}, h('p', { class: 'note' }, 'اربط كل كلمة/جملة بملف فيديو لشخص يؤدي لغة الإشارة المصرية. لا تُضف فيديو إلا إذا كان حقيقيًا ومراجعًا من مختص.'),
    h('button', { class: 'btn primary block', type: 'button', onclick: () => edit() }, '＋ إضافة كلمة/جملة'), q, catSel, list);
}

/* ---------- تبويب الأسئلة ---------- */
function tabQuestions() {
  const c = content(); const list = h('div', { class: 'list' });
  const edit = qn => {
    const isNew = !qn; const x = qn || { id: uid('q'), catId: c.categories[0]?.id, text: '', answerType: 'yesno', choices: [], signId: '' };
    formModal({
      title: isNew ? 'إضافة سؤال طبي' : 'تعديل السؤال', values: { ...x, choices: x.choices.join('، ') },
      fields: [
        { name: 'text', label: 'نص السؤال', required: true },
        { name: 'catId', label: 'التصنيف', type: 'select', options: catOptions(c), required: true },
        { name: 'answerType', label: 'نوع الإجابة', type: 'select', options: Object.entries(ANSWER_TYPES).map(([v, l]) => ({ v, l })) },
        { name: 'choices', label: 'الاختيارات (إن كانت اختيارات)', hint: 'افصل بينها بفاصلة، مثال: الرأس، الصدر، البطن' },
        { name: 'signId', label: 'فيديو الإشارة المرتبط', type: 'select', options: signOptions(c) }
      ],
      onSave: o => {
        const choices = o.choices.split(/[,،]/).map(s => s.trim()).filter(Boolean);
        if (o.answerType === 'choices' && choices.length < 2) throw new Error('اكتب اختيارين على الأقل.');
        Object.assign(x, { text: o.text, catId: o.catId, answerType: o.answerType, choices: o.answerType === 'choices' ? choices : [], signId: o.signId });
        if (isNew) c.questions.push(x);
        save(); toast('تم الحفظ.', 'success'); draw();
      }
    });
  };
  const draw = () => list.replaceChildren(...c.questions.map(x => {
    const sign = byId(c.signs, x.signId);
    return h('div', { class: 'row wrap' },
      h('span', { class: 'row-main' }, h('strong', { dir: 'auto' }, x.text), h('small', {}, (byId(c.categories, x.catId)?.title || '') + ' — ' + ANSWER_TYPES[x.answerType])),
      sign ? videoBadge(sign) : badge('بلا فيديو مرتبط', 'no'),
      h('span', { class: 'row-actions' },
        h('button', { class: 'btn secondary', type: 'button', onclick: () => edit(x) }, 'تعديل'),
        h('button', { class: 'btn ghost', type: 'button', onclick: async () => { if (await confirmBox('حذف هذا السؤال؟')) { c.questions = c.questions.filter(y => y !== x); save(); draw(); } } }, 'حذف')));
  }));
  draw();
  return h('div', {}, h('button', { class: 'btn primary block', type: 'button', onclick: () => edit() }, '＋ إضافة سؤال'), list);
}

/* ---------- الأيقونات (إيموجي أو صورة) ---------- */
async function applyIcon(item, o) {
  if (o.iconFile) {
    if (!o.iconFile.type.startsWith('image/')) throw new Error('الملف المختار ليس صورة.');
    await Media.put('img:' + item.id, o.iconFile); item.icon = 'img:' + item.id;
  } else if (o.icon && o.icon !== item.icon) {
    if (item.icon?.startsWith('img:')) await Media.del(item.icon);
    item.icon = o.icon;
  }
}

/* ---------- تبويب الأعراض ---------- */
function tabSymptoms() {
  const c = content(); const list = h('div', { class: 'list' });
  const edit = sym => {
    const isNew = !sym; const x = sym || { id: uid('sy'), name: '', icon: '🩺', signId: '', urgent: null };
    formModal({
      title: isNew ? 'إضافة عرض' : 'تعديل العرض', values: { ...x, urgentFlag: !!x.urgent },
      fields: [
        { name: 'name', label: 'اسم العرض', required: true },
        { name: 'icon', label: 'أيقونة (إيموجي أو body:head / body:chest / body:abdomen)', hint: 'أو ارفع صورة أدناه.' },
        { name: 'iconFile', label: 'صورة للعرض (اختياري)', type: 'file', accept: 'image/*' },
        { name: 'signId', label: 'فيديو الإشارة المرتبط', type: 'select', options: signOptions(c) },
        { name: 'urgentFlag', label: 'يعرض تنبيه «اطلب المساعدة فورًا» عند اختياره', type: 'checkbox' }
      ],
      onSave: async o => {
        x.name = o.name; x.signId = o.signId; x.urgent = o.urgentFlag ? (x.urgent || 'always') : null;
        await applyIcon(x, o);
        if (isNew) c.symptoms.push(x);
        save(); toast('تم الحفظ.', 'success'); draw();
      }
    });
  };
  const draw = () => list.replaceChildren(...c.symptoms.map(x => h('div', { class: 'row wrap' },
    h('span', { class: 'row-icon' }, iconEl(x.icon)),
    h('span', { class: 'row-main' }, h('strong', {}, x.name), h('small', {}, x.urgent ? 'ينبّه لطلب المساعدة' : '')),
    byId(c.signs, x.signId) ? videoBadge(byId(c.signs, x.signId)) : badge('بلا فيديو مرتبط', 'no'),
    h('span', { class: 'row-actions' },
      h('button', { class: 'btn secondary', type: 'button', onclick: () => edit(x) }, 'تعديل'),
      h('button', { class: 'btn ghost', type: 'button', onclick: async () => { if (await confirmBox('حذف هذا العرض؟')) { c.symptoms = c.symptoms.filter(y => y !== x); if (x.icon?.startsWith('img:')) await Media.del(x.icon); save(); draw(); } } }, 'حذف')))));
  draw();
  return h('div', {}, h('button', { class: 'btn primary block', type: 'button', onclick: () => edit() }, '＋ إضافة عرض'), list);
}

/* ---------- تبويب التصنيفات ---------- */
function tabCategories() {
  const c = content(); const list = h('div', { class: 'list' });
  const edit = cat => {
    const isNew = !cat; const x = cat || { id: uid('c'), title: '', icon: '📁', desc: '' };
    formModal({
      title: isNew ? 'إضافة تصنيف' : 'تعديل التصنيف', values: x,
      fields: [{ name: 'title', label: 'اسم التصنيف', required: true }, { name: 'desc', label: 'وصف بسيط' },
        { name: 'icon', label: 'أيقونة (إيموجي)' }, { name: 'iconFile', label: 'أو صورة', type: 'file', accept: 'image/*' }],
      onSave: async o => { x.title = o.title; x.desc = o.desc; await applyIcon(x, o); if (isNew) c.categories.push(x); save(); toast('تم الحفظ.', 'success'); draw(); }
    });
  };
  const draw = () => list.replaceChildren(...c.categories.map(x => {
    const used = c.signs.filter(s => s.catId === x.id).length + c.questions.filter(q => q.catId === x.id).length;
    return h('div', { class: 'row wrap' }, h('span', { class: 'row-icon' }, iconEl(x.icon)),
      h('span', { class: 'row-main' }, h('strong', {}, x.title), h('small', {}, used + ' عنصر')),
      h('span', { class: 'row-actions' },
        h('button', { class: 'btn secondary', type: 'button', onclick: () => edit(x) }, 'تعديل'),
        h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
          if (used) return toast('انقل العناصر إلى تصنيف آخر قبل حذف هذا التصنيف.', 'error');
          if (await confirmBox('حذف هذا التصنيف؟')) { c.categories = c.categories.filter(y => y !== x); save(); draw(); }
        } }, 'حذف')));
  }));
  draw();
  return h('div', {}, h('button', { class: 'btn primary block', type: 'button', onclick: () => edit() }, '＋ إضافة تصنيف'), list);
}

/* ---------- تبويب الأدوات ---------- */
function tabTools(redraw) {
  const c = content();
  const importIn = h('input', { type: 'file', accept: 'application/json', class: 'input', 'aria-label': 'ملف المحتوى' });
  return h('div', {},
    h('div', { class: 'card' }, h('h2', {}, 'نسخة احتياطية'),
      h('p', { class: 'note' }, 'تُحفظ التعديلات على هذا الجهاز. لنقلها إلى أجهزة أخرى صدّر الملف ثم استورده هناك. (ملفات الفيديو المرفوعة لا تدخل في الملف؛ ضعها في مجلد videos عند بناء التطبيق.)'),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' })), download: 'tabibi-content.json' });
        document.body.append(a); a.click(); a.remove(); toast('تم تصدير الملف.', 'success');
      } }, '⬇ تصدير المحتوى'),
      h('label', { class: 'field' }, 'استيراد ملف محتوى', importIn),
      h('button', { class: 'btn secondary block', type: 'button', onclick: async () => {
        const f = importIn.files[0]; if (!f) return toast('اختر ملفًا أولًا.', 'error');
        try { replaceContent(JSON.parse(await f.text())); clearProbe(); toast('تم استيراد المحتوى.', 'success'); redraw(); } catch (e) { toast(e.message || 'ملف غير صالح.', 'error'); }
      } }, 'استيراد')),
    h('div', { class: 'card' }, h('h2', {}, 'حالة الفيديوهات'), (() => {
      const out = h('p', { class: 'note' }, 'جارٍ الحساب…');
      Promise.all(c.signs.map(videoSource)).then(r => { out.textContent = `${r.filter(Boolean).length} فيديو متوفر من أصل ${c.signs.length}. الباقي يعرض «الفيديو غير متوفر حاليًا».`; });
      return out;
    })()),
    h('div', { class: 'card' }, h('h2', {}, 'إعادة الضبط'),
      h('button', { class: 'btn danger block', type: 'button', onclick: async () => { if (await confirmBox('سيتم استبدال كل المحتوى بالبيانات التجريبية الأصلية. متابعة؟')) { resetContent(); clearProbe(); toast('أُعيد المحتوى التجريبي.', 'success'); redraw(); } } }, 'العودة إلى البيانات التجريبية')));
}

export function admin({ tab = 'signs' }) {
  const s = Session.get();
  const body = h('div');
  const tabs = [['signs', '🤟 الفيديوهات والجمل'], ['questions', '❓ الأسئلة'], ['symptoms', '🖼️ الأعراض'], ['categories', '🗂️ التصنيفات'], ['tools', '🧰 أدوات']];
  const redraw = () => body.replaceChildren({ signs: tabSigns, questions: tabQuestions, symptoms: tabSymptoms, categories: tabCategories, tools: tabTools }[tab](redraw));
  redraw();
  return {
    title: 'إدارة المحتوى', noFab: true,
    el: h('div', {},
      h('div', { class: 'card' }, h('strong', {}, s.name), ' ', h('button', { class: 'btn ghost', type: 'button', onclick: () => { Session.clear(); location.hash = '#/'; } }, 'تسجيل الخروج')),
      h('nav', { class: 'tabs', 'aria-label': 'أقسام الإدارة' }, tabs.map(([k, l]) => h('a', { class: 'tab' + (k === tab ? ' on' : ''), href: '#/admin/' + k, 'aria-current': k === tab ? 'page' : null }, l))),
      body)
  };
}
