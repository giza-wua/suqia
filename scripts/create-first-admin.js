#!/usr/bin/env node
// =====================================================================
// create-first-admin.js — أول مستخدم مدير عام لازم يتزرع مباشرة في
// قاعدة D1 عن طريق SQL (مش من واجهة الموقع)، لأن إضافة مستخدم من
// الموقع نفسه محتاجة إنك أصلاً مسجّل دخول كمدير عام — أول مرة مفيش
// حد أصلاً. بعد ما تعمل ده مرة واحدة، تقدر تضيف باقي الفريق عادي من
// صفحة الإعدادات داخل الموقع.
//
// الاستخدام:
//   node create-first-admin.js "كلمة-مرور-قوية"
//
// هيطبعلك أمر SQL جاهز، انسخه ونفّذه زي ما هو:
//   wrangler d1 execute zimam-giza --remote --command "..."
// =====================================================================

import crypto from "node:crypto";

const password = process.argv[2];
if (!password) { console.error('الاستخدام: node create-first-admin.js "كلمة-مرور-قوية"'); process.exit(1); }
if (password.length < 6) { console.error("كلمة المرور قصيرة جداً، 6 أحرف على الأقل."); process.exit(1); }

const id = crypto.randomUUID();
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, 10_000, 32, "sha256"); // لازم يطابق PBKDF2_ITERATIONS في functions/api/[[path]].js بالظبط

const sql = `INSERT INTO users (id,username,phone,email,has_real_email,password_hash,password_salt,display_name,role) VALUES ('${id}','admin',NULL,'admin@internal.zimam',0,'${hash.toString("hex")}','${salt.toString("hex")}','المدير العام', 'admin');`;

console.log("\n✅ نفّذ الأمر ده بالظبط (بعد ما تعمل wrangler d1 execute --file=./schema.sql):\n");
console.log(`wrangler d1 execute zimam-giza --remote --command "${sql.replace(/"/g, '\\"')}"`);
console.log(`\nبعد كده هتقدر تدخل على الموقع باسم المستخدم: admin وكلمة المرور اللي كتبتها دلوقتي.`);
console.log("غيّر اسم المستخدم لو حبيت من صفحة الإعدادات بعد أول دخول، أو عدّل username='admin' في الأمر فوق قبل التنفيذ.");
