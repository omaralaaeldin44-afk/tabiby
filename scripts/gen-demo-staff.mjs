// يولّد ملف www/js/staff-demo.js (حسابات تجريبية للوضع المحلي فقط - PBKDF2)
import crypto from 'node:crypto'; import fs from 'node:fs';
const acc=[['dr.demo','طبيب تجريبي','doctor','Demo@Doctor1'],['nurse.demo','ممرض تجريبي','nurse','Demo@Nurse1'],['admin.demo','مدير المحتوى التجريبي','admin','Demo@Admin1'],['interp.demo','مترجم إشارة تجريبي','interpreter','Demo@Interp1']];
const IT=100000, out={};
for(const [u,name,role,pw] of acc){const salt=crypto.randomBytes(16);out[u]={name,role,salt:salt.toString('base64'),iter:IT,hash:crypto.pbkdf2Sync(pw,salt,IT,32,'sha256').toString('base64')};}
fs.writeFileSync(new URL('../www/js/staff-demo.js',import.meta.url),'// حسابات تجريبية فقط. لا تستخدمها في الإنتاج. (مولّد بواسطة scripts/gen-demo-staff.mjs)\nexport const DEMO_STAFF = '+JSON.stringify(out,null,2)+';\n');
console.log('ok');
