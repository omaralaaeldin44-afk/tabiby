// إضافة حساب طبيب/ممرض/مدير:  npm run add-staff -- <user> <doctor|nurse|admin> <password> "<الاسم>"
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const [user, role, pw, name] = process.argv.slice(2);
if (!user || !['doctor', 'nurse', 'admin'].includes(role) || !pw || pw.length < 8) {
  console.error('الاستخدام: npm run add-staff -- <user> <doctor|nurse|admin> <password (8+ أحرف)> "<الاسم>"');
  process.exit(1);
}
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const file = path.join(dir, 'staff.json');
fs.mkdirSync(dir, { recursive: true });
const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const salt = crypto.randomBytes(16).toString('hex');
all[user] = { name: name || user, role, salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') };
fs.writeFileSync(file, JSON.stringify(all, null, 2), { mode: 0o600 });
console.log(`تمت إضافة/تحديث الحساب: ${user} (${role})`);
