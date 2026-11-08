// حالة التطبيق المحلية: إعدادات، بيانات المريض (على هذا الهاتف فقط)، وجلسة الطبيب.
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
export { ls };

export const Settings = {
  get serverUrl() { return ls.get('tby_server', ''); },
  set serverUrl(v) { ls.set('tby_server', v); }
};

const emptyPatient = () => ({ symptoms: {}, pains: [], alias: '', roomId: null, roomKey: null, roomCode: null, shared: false });
export const Patient = {
  s: { ...emptyPatient(), ...ls.get('tby_patient', {}) },
  save() { ls.set('tby_patient', this.s); },
  clear() { this.s = emptyPatient(); ls.del('tby_patient'); },
  resetRoom() { Object.assign(this.s, { roomId: null, roomKey: null, roomCode: null, shared: false }); this.save(); }
};

export const Session = {
  get() { try { return JSON.parse(sessionStorage.getItem('tby_staff')); } catch { return null; } },
  set(v) { try { sessionStorage.setItem('tby_staff', JSON.stringify(v)); } catch { /* ignore */ } },
  clear() { try { sessionStorage.removeItem('tby_staff'); } catch { /* ignore */ } }
};

// هل اختيار المريض يستدعي تنبيهًا بطلب مساعدة فورية؟ (تنبيه فقط، وليس تشخيصًا)
export function urgentReason(content) {
  const s = Patient.s;
  for (const sym of content.symptoms) {
    const sel = s.symptoms[sym.id];
    if (!sel) continue;
    if (sym.urgent === 'always') return sym.name;
    if (sym.urgent === 'severe' && sel.severity === 3) return sym.name + ' الشديد';
  }
  if (s.pains.some(p => p.part === 'chest' && p.severity === 3)) return 'ألم شديد في الصدر';
  return null;
}
