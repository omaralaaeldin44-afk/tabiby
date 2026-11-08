// شاشات المريض: الرئيسية، الأعراض بالصور، مكان الألم، المقابلة.
import { h, go, toast, iconEl, badge, bodySVG, modal, confirmBox, videoPlayer } from './ui.js';
import { content, byId } from './db.js';
import { Patient, urgentReason } from './state.js';
import { Rooms, Net, subscribe } from './rooms.js';
import { BODY_PARTS, SEVERITY } from './seed.js';
import { tile, netBadge } from './screens-public.js';
import { Direct, patientLinkFlow } from './direct.js';

const sevClass = ['', 'mild', 'mid', 'high'];

export function urgentBanner(app) {
  const r = urgentReason(content());
  if (!r) return null;
  return h('div', { class: 'alert urgent', role: 'alert' },
    h('strong', {}, '⚠️ اطلب المساعدة الطبية فورًا'),
    h('p', {}, `اخترتَ: ${r}. أخبر أقرب طبيب أو ممرض الآن ولا تنتظر.`),
    h('button', { class: 'btn danger', type: 'button', onclick: () => app.helpNow() }, '🆘 أحتاج مساعدة الآن'));
}

const sevButtons = (current, onPick) => h('div', { class: 'sev-row', role: 'group', 'aria-label': 'الشدة' },
  [1, 2, 3].map(n => h('button', { class: `sev ${sevClass[n]}`, type: 'button', 'aria-pressed': current === n, onclick: () => onPick(n) },
    h('span', { 'aria-hidden': 'true' }, ['', '🙂', '😟', '😣'][n]), SEVERITY[n])));

/* ---------- لوحة المريض ---------- */
export function patientHub(_, app) {
  const c = content();
  const root = h('div');
  const draw = () => {
    const s = Patient.s;
    const syms = Object.entries(s.symptoms).map(([id, v]) => ({ sym: byId(c.symptoms, id), v })).filter(x => x.sym);
    root.replaceChildren(
      urgentBanner(app),
      h('div', { class: 'tiles' },
        tile({ icon: 'image', title: 'الأعراض بالصور', sub: 'اختر ما تشعر به', cls: 'primary', href: '/symptoms' }),
        tile({ icon: 'map-pin', title: 'مكان الألم وشدته', sub: 'اضغط على صورة الجسم', cls: 'amber', href: '/pain' }),
        tile({ icon: 'message-square', title: 'المقابلة ورسالة للطبيب', sub: 'اقرأ الأسئلة وأجب واكتب رسالتك', cls: 'blue', href: '/visit' }),
        tile({ icon: 'video', title: 'فيديو شكوى بالإشارة', sub: 'مترجم متفرغ يترجم شكواك للطبيب', href: '/complaint' }),
        tile({ icon: 'calendar-clock', title: 'موعد عيادة ومترجم', sub: 'اطلب مترجمًا يرافقك', cls: 'amber', href: '/appointment' }),
        tile({ icon: 'hand', title: 'فيديوهات لغة الإشارة', sub: 'تعلّم الجمل المهمة', href: '/signs' })),
      h('div', { class: 'card' }, h('h2', {}, 'ما اخترته'),
        (!syms.length && !s.pains.length) ? h('p', { class: 'note' }, 'لم تختر شيئًا بعد.') : h('div', { class: 'chips' },
          syms.map(({ sym, v }) => h('span', { class: 'chip ' + sevClass[v.severity] }, sym.name, v.severity ? ' — ' + SEVERITY[v.severity] : ' — حدّد الشدة')),
          s.pains.map(p => h('span', { class: 'chip ' + sevClass[p.severity] }, 'ألم: ' + p.label + ' — ' + SEVERITY[p.severity])))));
  };
  draw();
  return { title: 'أنا مريض', sub: 'اختر ما يناسبك', el: root };
}

/* ---------- الأعراض بالصور ---------- */
export function symptomsPage(_, app) {
  const c = content();
  const wrap = h('div'); const grid = h('div', { class: 'sym-grid' });
  const draw = () => {
    wrap.replaceChildren(urgentBanner(app), grid);
    grid.replaceChildren(...c.symptoms.map(sym => {
      const sel = Patient.s.symptoms[sym.id];
      const sign = byId(c.signs, sym.signId);
      const main = h('button', {
        class: 'sym-main', type: 'button', 'aria-pressed': !!sel,
        onclick: () => {
          if (sym.goPain) return go('/pain');
          if (sel) delete Patient.s.symptoms[sym.id]; else Patient.s.symptoms[sym.id] = { severity: 0 };
          Patient.save(); draw();
        }
      }, iconEl(sym.icon), h('strong', {}, sym.name), sel && h('span', { class: 'tick' }, '✓ تم الاختيار'));
      return h('div', { class: 'sym' + (sel ? ' on' : '') },
        main,
        sign && h('button', { class: 'sym-sign', type: 'button', onclick: () => modal({ title: sym.name, body: videoPlayer(sign), actions: [{ label: 'إغلاق', cls: 'primary' }] }) }, '🤟 شاهد الإشارة'),
        sel && h('div', {}, h('p', { class: 'note' }, 'ما شدة ' + sym.name + '؟'),
          sevButtons(sel.severity, n => { sel.severity = n; Patient.save(); draw(); })));
    }));
  };
  draw();
  return {
    title: 'الأعراض بالصور',
    el: h('div', {}, h('p', { class: 'note' }, 'اضغط على الصورة التي تشبه ما تشعر به. يمكنك اختيار أكثر من عرض.'), wrap,
      h('a', { class: 'btn primary block', href: '#/visit' }, 'التالي: مقابلة الطبيب ←'))
  };
}

/* ---------- مكان الألم ---------- */
export function painPage(_, app) {
  const c = content();
  const painSign = byId(c.signs, 'p5');
  let cur = null;
  const mapBox = h('div', { class: 'bodymap' });
  const chips = h('div', { class: 'chips big' });
  const panel = h('div', { class: 'card' });
  const listBox = h('div', { class: 'card' });
  const alertBox = h('div');

  const pick = part => { cur = part; draw(); };
  mapBox.addEventListener('click', e => { const p = e.target.closest('[data-part]'); if (p) pick(p.dataset.part); });

  const draw = () => {
    const done = Patient.s.pains.map(p => p.part);
    mapBox.innerHTML = bodySVG({ active: [...new Set([...done, cur].filter(Boolean))], interactive: true, label: 'صورة الجسم. اضغط على مكان الألم' });
    mapBox.querySelectorAll('[data-part]').forEach(el => {
      el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); el.setAttribute('aria-label', BODY_PARTS[el.dataset.part]);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(el.dataset.part); } });
    });
    chips.replaceChildren(...Object.entries(BODY_PARTS).map(([k, l]) =>
      h('button', { class: 'chip btn-chip' + (cur === k ? ' sel' : '') + (done.includes(k) ? ' done' : ''), type: 'button', 'aria-pressed': cur === k, onclick: () => pick(k) }, l)));
    const existing = Patient.s.pains.find(p => p.part === cur);
    panel.replaceChildren(cur
      ? h('div', {}, h('h2', {}, 'مكان الألم: ' + BODY_PARTS[cur]), h('p', { class: 'note' }, 'ما شدة الألم هنا؟'),
        sevButtons(existing?.severity || 0, n => {
          const p = { part: cur, label: BODY_PARTS[cur], severity: n };
          const i = Patient.s.pains.findIndex(x => x.part === cur);
          if (i >= 0) Patient.s.pains[i] = p; else Patient.s.pains.push(p);
          Patient.save(); toast('تم تسجيل الألم: ' + p.label + ' — ' + SEVERITY[n], 'success', 2500); draw();
        }))
      : h('p', { class: 'note' }, 'اضغط على مكان الألم في الصورة أو من الأزرار.'));
    listBox.replaceChildren(h('h2', {}, 'الأماكن المسجّلة'),
      Patient.s.pains.length ? h('div', { class: 'list' }, Patient.s.pains.map(p => h('div', { class: 'row' },
        h('span', { class: 'row-main' }, h('strong', {}, p.label), h('small', {}, 'الشدة: ' + SEVERITY[p.severity])),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { Patient.s.pains = Patient.s.pains.filter(x => x !== p); Patient.save(); draw(); } }, 'حذف'))))
        : h('p', { class: 'note' }, 'لم تسجّل مكان ألم بعد.'));
    alertBox.replaceChildren(urgentBanner(app));
  };
  draw();
  return {
    title: 'مكان الألم وشدته',
    el: h('div', {}, alertBox,
      h('p', { class: 'note' }, 'الصورة من الأمام. «اليمنى» و«اليسرى» من جهتك أنت.'),
      painSign && h('button', { class: 'btn ghost', type: 'button', onclick: () => modal({ title: 'ألم', body: videoPlayer(painSign), actions: [{ label: 'إغلاق', cls: 'primary' }] }) }, '🤟 شاهد إشارة «ألم»'),
      mapBox, chips, panel, listBox,
      h('a', { class: 'btn primary block', href: '#/visit' }, 'التالي: مقابلة الطبيب ←'))
  };
}

/* ---------- عرض الرسائل (مشترك بين المريض والطبيب) ---------- */
export function renderThread(room, { who, onAnswer }) {
  const c = content(); const box = h('div', { class: 'thread', 'aria-live': 'polite' });
  const answers = new Map(room.messages.filter(m => m.type === 'answer').map(m => [m.qid, m]));
  for (const m of room.messages) {
    if (m.type === 'text') {
      box.append(h('div', { class: 'bubble ' + (m.from === who ? 'mine' : 'theirs') },
        h('small', {}, m.from === 'patient' ? 'المريض' : 'الطبيب/الممرض'), h('p', { dir: 'auto' }, m.text)));
    } else if (m.type === 'question') {
      const sign = byId(c.signs, m.signId);
      const ans = answers.get(m.id);
      box.append(h('div', { class: 'qcard' },
        h('small', {}, who === 'patient' ? 'سؤال من الطبيب/الممرض' : 'سؤال أُرسل للمريض'),
        h('p', { class: 'q-text', dir: 'auto' }, m.text),
        sign && videoPlayer(sign),
        ans ? h('div', { class: 'answer' }, 'الإجابة: ', h('strong', {}, ans.answer))
          : (who === 'patient' && onAnswer) ? answerWidget(m, onAnswer) : h('p', { class: 'note' }, '⏳ بانتظار إجابة المريض…')));
    } else if (m.type === 'answer' && !room.messages.some(q => q.id === m.qid)) {
      box.append(h('div', { class: 'bubble ' + (m.from === who ? 'mine' : 'theirs') }, h('p', {}, 'إجابة: ' + m.answer)));
    } else if (m.type === 'help') {
      box.append(h('div', { class: 'alert urgent' }, '🆘 ' + (who === 'patient' ? 'طلبتَ المساعدة' : 'المريض طلب المساعدة') + ' — ' + new Date(m.t).toLocaleTimeString('ar-EG')));
    } else if (m.type === 'ack') {
      box.append(h('div', { class: 'alert ok' }, '✅ ' + (who === 'patient' ? 'تم استلام طلبك من الطبيب/الممرض.' : 'تم تسجيل استلام طلب المساعدة.')));
    }
  }
  if (!room.messages.length) box.append(h('p', { class: 'empty' }, 'لا توجد رسائل بعد.'));
  return box;
}

function answerWidget(q, onAnswer) {
  const wrap = h('div', { class: 'answers' });
  const send = v => { wrap.querySelectorAll('button').forEach(b => (b.disabled = true)); onAnswer(q, v).catch(() => wrap.querySelectorAll('button').forEach(b => (b.disabled = false))); };
  if (q.answerType === 'text') {
    const t = h('textarea', { class: 'input', rows: '2', 'aria-label': 'اكتب إجابتك' });
    wrap.append(t, h('button', { class: 'btn primary', type: 'button', onclick: () => { if (!t.value.trim()) return toast('اكتب إجابتك أولًا.', 'error'); send(t.value.trim()); } }, 'إرسال الإجابة'));
  } else {
    const opts = q.answerType === 'choices' && q.choices?.length ? q.choices : ['نعم', 'لا', 'لا أعرف'];
    wrap.classList.add(q.answerType === 'yesno' ? 'yn' : 'ch');
    opts.forEach(o => wrap.append(h('button', { class: 'btn ans ' + (o === 'نعم' ? 'yes' : o === 'لا' ? 'no' : 'secondary'), type: 'button', onclick: () => send(o) }, o)));
  }
  return wrap;
}

/* ---------- المقابلة ---------- */
export function visit(_, app) {
  const c = content();
  const root = h('div'); let unsub = null;

  const sharePayload = () => ({
    symptoms: Object.entries(Patient.s.symptoms).map(([id, v]) => { const s = byId(c.symptoms, id); return s && { id, name: s.name, severity: v.severity, urgent: s.urgent || null }; }).filter(Boolean),
    pains: Patient.s.pains.map(p => ({ part: p.part, label: p.label, severity: p.severity }))
  });

  const startIntro = () => {
    const alias = h('input', { class: 'input', maxlength: '30', placeholder: 'مثال: مريض غرفة 3 (اختياري)', 'aria-label': 'اسم للنداء' });
    root.replaceChildren(
      urgentBanner(app),
      h('div', { class: 'card' },
        h('h2', {}, 'ابدأ مقابلة مع الطبيب أو الممرض'),
        h('p', { class: 'lead' }, 'سيظهر لك رمز من 4 أرقام. أعطِه للطبيب أو الممرض ليفتح مقابلتك.'),
        netBadge(),
        Net.mode === 'local' && h('p', { class: 'note' }, 'بعد البدء يمكنك ربط هاتفك مباشرة بهاتف الطبيب دون إنترنت (نفس الواي فاي أو نقطة اتصال)، أو تسليم هاتفك للطبيب ليسجّل دخوله ويسألك عليه.'),
        h('label', { class: 'field' }, 'اسم للنداء (اختياري — لا تكتب بيانات شخصية)', alias),
        h('button', { class: 'btn primary block', type: 'button', onclick: async e => {
          const btn = e.currentTarget; btn.disabled = true;
          try {
            const r = await Rooms.create(alias.value.trim());
            Object.assign(Patient.s, { roomId: r.id, roomKey: r.key, roomCode: r.code, shared: false }); Patient.save();
            toast('بدأت المقابلة. رمزك: ' + r.code, 'success'); begin();
          } catch { btn.disabled = false; toast('تعذّر الاتصال بالخادم. تأكد من الشبكة أو من الإعدادات.', 'error'); }
        } }, 'ابدأ المقابلة')),
      h('a', { class: 'btn secondary block', href: '#/symptoms' }, '🖼️ اختيار الأعراض أولًا'));
  };

  const begin = () => {
    unsub?.();
    const id = Patient.s.roomId;
    const status = h('div', { class: 'card' });
    const link = h('div', { class: 'card' });
    const consent = h('div', { class: 'card' });
    const thread = h('div');
    const composer = buildComposer(id);
    const drawStatic = () => {
      status.replaceChildren(
        h('h2', {}, 'رمز المقابلة'), h('div', { class: 'code', dir: 'ltr', 'aria-label': 'رمز المقابلة ' + Patient.s.roomCode }, Patient.s.roomCode),
        h('p', { class: 'note' }, 'أعطِ هذا الرمز للطبيب أو الممرض.'), netBadge(),
        Net.mode === 'local' && !Direct.patientConnected() && h('p', { class: 'note' }, 'هاتفك غير مرتبط بهاتف الطبيب بعد. الرسائل محفوظة على هذا الهاتف حتى تربطه.'));
      link.replaceChildren(...(Net.mode !== 'local' ? [] : Direct.patientConnected()
        ? [h('h2', {}, '🔗 الربط المباشر'), badge('✓ هاتفك مرتبط بهاتف الطبيب/الممرض. الرسائل والأسئلة تصل فورًا.', 'ok'),
          h('button', { class: 'btn ghost block', type: 'button', onclick: () => Direct.closePatient() }, 'قطع الربط')]
        : [h('h2', {}, '🔗 ربط مباشر بهاتف الطبيب (بدون إنترنت)'),
          h('p', { class: 'note' }, 'الهاتفان على نفس الواي فاي، أو يفتح أحدهما «نقطة اتصال» ويتصل بها الآخر. ثم يمسح كل منكما رمز الآخر.'),
          h('button', { class: 'btn blue block', type: 'button', onclick: () => patientLinkFlow() }, '🔗 ابدأ الربط المباشر')]));
      consent.replaceChildren(h('h2', {}, 'مشاركة الأعراض'),
        Patient.s.shared
          ? [h('p', {}, badge('✓ الأعراض مشاركة مع الطبيب/الممرض في هذه المقابلة', 'ok')),
            h('div', { class: 'row-actions' },
              h('button', { class: 'btn secondary', type: 'button', onclick: () => doShare() }, '↻ تحديث ما أشاركه'),
              h('button', { class: 'btn ghost', type: 'button', onclick: async () => { await Rooms.unshare(id); Patient.s.shared = false; Patient.save(); drawStatic(); toast('تم إيقاف المشاركة وحذف الأعراض من المقابلة.', 'success'); } }, 'إيقاف المشاركة'))]
          : [h('p', { class: 'note' }, 'لن يرى الطبيب أعراضك إلا بعد موافقتك. يمكنك إيقاف المشاركة في أي وقت.'),
            h('button', { class: 'btn primary block', type: 'button', onclick: () => doShare() }, '✅ أوافق على مشاركة أعراضي')]);
    };
    const doShare = async () => {
      try { await Rooms.share(id, sharePayload()); Patient.s.shared = true; Patient.save(); drawStatic(); toast('تمت مشاركة أعراضك مع الطبيب/الممرض.', 'success'); }
      catch { toast('تعذّرت المشاركة. تحقق من الاتصال.', 'error'); }
    };
    const onAnswer = async (q, answer) => {
      try { await Rooms.post(id, 'patient', { type: 'answer', qid: q.id, answer }); toast('أُرسلت إجابتك.', 'success', 2500); }
      catch (e) { toast('تعذّر إرسال الإجابة.', 'error'); throw e; }
    };
    drawStatic();
    root.replaceChildren(urgentBanner(app), status, link, consent, h('div', { class: 'card' }, h('h2', {}, 'الرسائل والأسئلة'), thread), composer,
      h('div', { class: 'card' },
        h('button', { class: 'btn blue block', type: 'button', onclick: () => go('/login/staff/' + id) }, '👨‍⚕️ تسليم الهاتف للطبيب (تسجيل دخول الطبيب)'),
        h('button', { class: 'btn ghost block', type: 'button', onclick: async () => {
          if (!await confirmBox('سيتم إنهاء المقابلة وحذف الرسائل والأعراض المشاركة. هل أنت متأكد؟', 'إنهاء المقابلة')) return;
          try { await Rooms.remove(id, 'patient'); } catch { /* قد تكون محذوفة */ }
          Patient.resetRoom(); unsub?.(); toast('انتهت المقابلة وحُذفت بياناتها.', 'success'); startIntro();
        } }, 'إنهاء المقابلة وحذف بياناتها')));
    const offDirect = Direct.onChange(() => drawStatic());
    const unsubRoom = subscribe(() => Rooms.get(id, 'patient'), (room, err) => {
      if (err) {
        if (err.status === 404 || err.status === 401) { Patient.resetRoom(); toast('انتهت هذه المقابلة. ابدأ مقابلة جديدة.', 'error'); return startIntro(); }
        return thread.replaceChildren(h('div', { class: 'alert warn' }, '⚠️ انقطع الاتصال بالخادم. سنحاول مرة أخرى تلقائيًا.'));
      }
      thread.replaceChildren(renderThread(room, { who: 'patient', onAnswer }));
      if (room.messages.some(m => m.type === 'question' && !room.messages.some(a => a.type === 'answer' && a.qid === m.id)) && navigator.vibrate) navigator.vibrate(200);
    });
    unsub = () => { unsubRoom(); offDirect(); };
  };

  function buildComposer(id) {
    const t = h('textarea', { class: 'input big-input', rows: '3', placeholder: 'اكتب رسالتك للطبيب هنا…', 'aria-label': 'رسالة للطبيب' });
    const quick = ['أحتاج مترجم لغة إشارة', 'لم أفهم، اكتب لي من فضلك', 'أعد السؤال من فضلك', 'أشعر بألم شديد'];
    const send = async () => {
      const text = t.value.trim();
      if (!text) return toast('اكتب رسالتك أولًا.', 'error');
      try {
        await Rooms.post(id, 'patient', { type: 'text', text }); t.value = '';
        const sent = Net.mode === 'server' || Direct.patientConnected();
        toast(sent ? 'أُرسلت رسالتك إلى الطبيب/الممرض.' : 'حُفظت الرسالة على هذا الهاتف، وستصل للطبيب عند ربط الهاتفين.', sent ? 'success' : 'info', 6000);
      } catch { toast('تعذّر إرسال الرسالة. تحقق من الاتصال.', 'error'); }
    };
    return h('div', { class: 'card' }, h('h2', {}, 'اكتب رسالة للطبيب'),
      h('div', { class: 'chips' }, quick.map(q => h('button', { class: 'chip btn-chip', type: 'button', onclick: () => { t.value = q; t.focus(); } }, q))),
      t, h('button', { class: 'btn primary block', type: 'button', onclick: send }, '📨 إرسال الرسالة'));
  }

  if (Patient.s.roomId) begin(); else startIntro();
  return { title: 'المقابلة', cleanup: () => unsub?.(), el: root };
}
