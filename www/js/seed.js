// بيانات تجريبية أولية. لا توجد هنا أي بيانات مرضى ولا ملفات فيديو حقيقية.
export const BODY_PARTS = {
  head: 'الرأس', neck: 'الرقبة', chest: 'الصدر', abdomen: 'البطن',
  armR: 'اليد/الذراع اليمنى', armL: 'اليد/الذراع اليسرى',
  legR: 'الرجل اليمنى', legL: 'الرجل اليسرى', back: 'الظهر', other: 'مكان آخر'
};
export const SEVERITY = ['', 'خفيف', 'متوسط', 'شديد'];
export const CAMPAIGN_TYPES = { vaccination: 'حملة تطعيم', awareness: 'حملة توعية', announcement: 'إعلان عام' };
export const COMPLAINT_SYMPTOMS = ['الصداع', 'ألم البطن', 'ألم الصدر', 'الدوخة', 'الحرارة', 'الغثيان', 'الحساسية', 'صعوبة التنفس'];
export const ANSWER_TYPES = { yesno: 'نعم / لا / لا أعرف', choices: 'اختيارات', text: 'كتابة' };

const CATS = [
  ['greet', 'التحية والتعريف بالنفس', 'pic:waving-hand', 'جمل للتعارف وبداية اللقاء.'],
  ['pain', 'الألم ومكان الألم', 'pic:round-pushpin', 'إشارات للسؤال عن الألم ومكانه وشدته.'],
  ['head', 'الصداع والدوخة والحرارة', 'pic:face-with-thermometer', 'أعراض شائعة يسأل عنها الطبيب.'],
  ['allergy', 'الحساسية من الأدوية', 'pic:sneezing-face', 'أسئلة عن الحساسية من الأدوية.'],
  ['meds', 'الأدوية وطريقة استخدامها', 'pic:pill', 'جمل عامة. طريقة الاستخدام يحددها الطبيب أو الصيدلي فقط.'],
  ['common', 'الأسئلة الطبية الشائعة', 'pic:stethoscope', 'أسئلة عامة يطرحها الطبيب أو الممرض.'],
  ['consent', 'الموافقة والرفض وطلب المساعدة', 'pic:check-mark-button', 'إجابات أساسية وطلب المساعدة.'],
  ['emergency', 'الطوارئ الطبية', 'pic:ambulance', 'جمل للحالات العاجلة.']
];

// [id, تصنيف, النص]
const SIGNS = [
  ['g1', 'greet', 'السلام عليكم'], ['g2', 'greet', 'أنا أصم'], ['g3', 'greet', 'أنا ضعيف السمع'],
  ['g4', 'greet', 'أنا الطبيب'], ['g5', 'greet', 'أنا الممرض أو الممرضة'],
  ['g6', 'greet', 'من فضلك انظر إليّ وتحدث ببطء'], ['g7', 'greet', 'هل تفضل التواصل بالكتابة؟'],
  ['p5', 'pain', 'ألم'], ['p1', 'pain', 'أين تشعر بالألم؟'], ['p2', 'pain', 'هل الألم شديد؟'],
  ['p3', 'pain', 'منذ متى بدأ الألم؟'], ['p4', 'pain', 'هل الألم مستمر أم يأتي ويذهب؟'],
  ['p6', 'pain', 'هل ينتقل الألم إلى مكان آخر؟'],
  ['h5', 'head', 'صداع'], ['h6', 'head', 'دوخة'], ['h7', 'head', 'حرارة'], ['h8', 'head', 'غثيان'],
  ['h1', 'head', 'هل عندك صداع؟'], ['h2', 'head', 'هل تشعر بدوخة؟'], ['h3', 'head', 'هل عندك حرارة؟'],
  ['h4', 'head', 'هل تشعر بغثيان أو قيء؟'],
  ['a3', 'allergy', 'حساسية'], ['a1', 'allergy', 'هل عندك حساسية من أي دواء؟'],
  ['a2', 'allergy', 'هل ظهر عندك طفح جلدي أو حكة بعد تناول دواء؟'],
  ['m1', 'meds', 'هل تأخذ أدوية بانتظام؟'], ['m2', 'meds', 'من فضلك أرني الأدوية التي تتناولها'],
  ['m3', 'meds', 'استخدم الدواء كما وصفه الطبيب فقط'], ['m4', 'meds', 'هل لديك وصفة أو تقرير طبي سابق؟'],
  ['m5', 'meds', 'اسأل الطبيب أو الصيدلي إذا لم تفهم طريقة الاستخدام'],
  ['c1', 'common', 'هل أنت حامل؟'], ['c2', 'common', 'هل عندك مرض مزمن مثل السكر أو الضغط؟'],
  ['c3', 'common', 'هل أجريت عملية جراحية من قبل؟'], ['c4', 'common', 'هل فهمت ما قلته؟'],
  ['c5', 'common', 'هل تريد أن أعيد السؤال؟'],
  ['o1', 'consent', 'نعم'], ['o2', 'consent', 'لا'], ['o3', 'consent', 'لا أعرف'],
  ['o4', 'consent', 'أوافق'], ['o5', 'consent', 'لا أوافق'], ['o6', 'consent', 'أحتاج مساعدة'],
  ['o7', 'consent', 'أحتاج مترجم لغة إشارة'],
  ['e6', 'emergency', 'صعوبة التنفس'], ['e7', 'emergency', 'ألم في الصدر'],
  ['e1', 'emergency', 'هل تجد صعوبة في التنفس؟'], ['e2', 'emergency', 'هل عندك ألم شديد في الصدر؟'],
  ['e3', 'emergency', 'هل فقدت الوعي؟'], ['e5', 'emergency', 'هل تنزف؟'],
  ['e4', 'emergency', 'طوارئ! أحتاج طبيبًا الآن']
];

const YN = 'yesno';
const PLACES = ['الرأس', 'الصدر', 'البطن', 'اليد', 'الرجل', 'مكان آخر'];
// [معرّف الإشارة, نوع الإجابة, الاختيارات]
const QUESTIONS = [
  ['p1', 'choices', PLACES], ['p2', 'choices', ['خفيف', 'متوسط', 'شديد']],
  ['p3', 'choices', ['اليوم', 'منذ أيام', 'منذ أسبوع أو أكثر']],
  ['p4', 'choices', ['مستمر', 'يأتي ويذهب']], ['p6', YN],
  ['h1', YN], ['h2', YN], ['h3', YN], ['h4', YN], ['a1', YN], ['a2', YN],
  ['m1', YN], ['m2', 'choices', ['حاضر', 'لا أستطيع']], ['m4', YN],
  ['c1', YN], ['c2', YN], ['c3', YN], ['c4', YN], ['c5', YN], ['g7', YN],
  ['e1', YN], ['e2', YN], ['e3', YN], ['e5', YN]
];

// urgent: always = تنبيه دائم عند الاختيار، severe = عند اختيار شدة "شديد"
const SYMPTOMS = [
  ['headache', 'الصداع', 'pic:face-with-head-bandage', 'h5', null],
  ['abdomen', 'ألم البطن', 'body:abdomen', 'p5', null],
  ['chest', 'ألم الصدر', 'pic:anatomical-heart', 'e7', 'severe'],
  ['dizzy', 'الدوخة', 'pic:face-with-spiral-eyes', 'h6', null],
  ['fever', 'الحرارة', 'pic:face-with-thermometer', 'h7', null],
  ['nausea', 'الغثيان', 'pic:nauseated-face', 'h8', null],
  ['allergy', 'الحساسية', 'pic:sneezing-face', 'a3', null],
  ['breath', 'صعوبة التنفس', 'pic:lungs', 'e6', 'always'],
  ['bodyache', 'ألم في مكان آخر من الجسم', 'pic:adhesive-bandage', 'p5', null, true]
];

// أيقونات قديمة (قبل الصور) تُستبدل تلقائيًا على الأجهزة التي حفظت المحتوى سابقًا، ما لم يغيّرها المدير.
export const OLD_ICONS = {
  greet: '👋', pain: '📍', head: '🌡️', allergy: '⚠️', meds: '💊', common: '❓', consent: '✅', emergency: '🚑',
  headache: 'body:head', chest: 'body:chest', dizzy: '😵', fever: '🌡️', nausea: '🤢', allergy_s: '🤧', breath: '🌬️', bodyache: 'body:armR'
};

export function seedContent() {
  const signs = SIGNS.map(([id, catId, text]) => ({ id, catId, text, desc: '', file: `videos/${id}.mp4`, url: '' }));
  const catOf = Object.fromEntries(SIGNS.map(s => [s[0], s[1]]));
  const textOf = Object.fromEntries(SIGNS.map(s => [s[0], s[2]]));
  return {
    version: 1, picsVersion: 1,
    categories: CATS.map(([id, title, icon, desc]) => ({ id, title, icon, desc })),
    signs,
    questions: QUESTIONS.map(([sid, answerType, choices]) => ({
      id: 'q_' + sid, catId: catOf[sid], text: textOf[sid], answerType, choices: choices || [], signId: sid
    })),
    symptoms: SYMPTOMS.map(([id, name, icon, signId, urgent, goPain]) => ({ id, name, icon, signId, urgent, goPain: !!goPain })),
    campaigns: seedCampaigns(),
    settings: { contactEmail: '' }
  };
}

// أمثلة تجريبية فقط — تُحذف أو تُعدّل من لوحة الإدارة.
export function seedCampaigns() {
  return [
    { id: 'cmp1', type: 'vaccination', title: 'مثال تجريبي: حملة تطعيم ضد الإنفلونزا', body: 'هذا مثال لشكل الحملة. اكتب هنا المكان والموعد والفئة المستهدفة، واربط الحملة بفيديو إشارة يشرحها.', date: '', place: '', signId: '', published: true },
    { id: 'cmp2', type: 'awareness', title: 'مثال تجريبي: يوم توعية بحقوق المريض الأصم', body: 'هذا مثال لحملة توعية. من حقك طلب مترجم لغة إشارة، ومن حقك أن تفهم ما يقوله الطبيب.', date: '', place: '', signId: '', published: true }
  ];
}
