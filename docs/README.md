<div dir="rtl">

# 💧 سُقيا — منصة إدارة أصول ري الجيزة

**الإصدار:** v1.1.10 | **الجهة:** الإدارة العامة لري الجيزة — وزارة الموارد المائية والري

> هذه نسخة موسّعة من التوثيق. للمقدمة السريعة راجع [`README.md`](../README.md) في جذر المشروع.

---

## نظرة عامة

**سُقيا** منصة ويب متكاملة لإدارة وتوثيق الأصول الهندسية لري محافظة الجيزة، تشمل:

| الوحدة | الوصف | Firestore Collection |
|--------|-------|----------------------|
| 🌊 ترع الإدارة | الأورنيك الهندسي للترع (مقاطع + مناوبات + تبطين) | `specs` + `linedCanals` |
| 🌉 الكباري | كباري الترع والمصارف | `bridges` |
| 💧 الآبار الجوفية | آبار المياه الجوفية وبيانات الطلمبات | `wells` |

---

## هيكل المشروع

```
suqia/
├── README.md           ← ملخص سريع (جذر المشروع)
├── CHANGELOG.md        ← سجل التغييرات (جذر المشروع)
├── assets/
│   ├── fonts/          ← خطوط Cairo محلية (woff2)
│   └── icons/          ← favicon.svg
├── css/
│   ├── 01-tokens.css   ← متغيرات التصميم وألوان الهوية
│   ├── 02-base.css     ← Reset وعناصر أساسية
│   ├── 03-layout.css   ← Sidebar + Topbar + Shell + Bottom Nav (موبايل)
│   ├── 04-components.css ← كروت + أزرار + DataList + Badges
│   ├── 05-pages.css    ← Modal + Forms + Dashboard + Media Queries للموبايل
│   └── style.css       ← @import فقط
├── data/
│   └── seed_data.js    ← بيانات الاستيراد الأصلية
├── docs/               ← التوثيق التفصيلي
│   ├── README.md
│   ├── CHANGELOG.md
│   └── SETUP.md
├── js/
│   ├── firebase-config.js ← Firebase + Auth + Cache
│   ├── shared.js          ← UI helpers + DataList class
│   └── sidebar.js         ← (قديم — الـ sidebar الآن inline)
├── pages/
│   ├── dashboard.html  ← لوحة التحكم الرئيسية
│   ├── canals.html     ← ترع الإدارة (موحّد)
│   ├── bridges.html    ← الكباري
│   ├── wells.html      ← الآبار الجوفية
│   ├── map.html        ← الخريطة التفاعلية الموحّدة
│   ├── settings.html   ← إدارة المستخدمين + الاستيراد
│   └── specs.html      ← redirect → canals.html
└── index.html          ← صفحة تسجيل الدخول
```

---

## التشغيل السريع

### المتطلبات
- مشروع Firebase مع Firestore مُفعَّل
- خادم ويب ثابت (VS Code Live Server / Python / Nginx)

### الخطوات

1. **استنساخ المشروع**
   ```bash
   git clone <repo-url>
   cd suqia
   ```

2. **ضبط Firebase** — في `js/firebase-config.js`:
   ```js
   const firebaseConfig = {
     apiKey: "YOUR_KEY",
     projectId: "YOUR_PROJECT",
     // ...
   };
   ```

3. **ضبط Firestore Rules** — في Firebase Console:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true; // للتطوير
       }
     }
   }
   ```

4. **تشغيل الخادم**
   ```bash
   # Python
   python -m http.server 7070
   # أو Node.js
   npx serve .
   ```

5. **أول تسجيل دخول**
   - اسم المستخدم: `maged`
   - كلمة المرور: `maged@2025`

6. **استيراد البيانات**
   - اذهب إلى `الإعدادات` ← `ابدأ الاستيراد`

---

## دعم الموبايل

منذ v1.1.4:
- شريط تنقل سفلي ثابت (Bottom Navigation) في كل الصفحات الخمس، مع تفعيل تلقائي للعنصر النشط
- مساحات لمس مريحة (≥40px) لكل الأزرار والأيقونات
- تم فحص كل صفحة فعلياً بمتصفح حقيقي على عرض 375px للتأكد من عدم وجود تمدد أفقي أو محتوى مقصوص

---

## نظام المصادقة

- مصادقة مخصصة عبر Firestore (بدون Firebase Auth)
- كلمات المرور مُشفَّرة بـ SHA-256 مع salt ثابت
- جلسات محفوظة في `sessionStorage`
- المستخدم الأول: `maged` — يُضاف تلقائياً عند أول دخول

---

## التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| Firebase Firestore | قاعدة البيانات الرئيسية |
| Vanilla JS (ES Modules) | منطق التطبيق بدون frameworks |
| خط Cairo (محلي) | واجهة عربية RTL |
| ExcelJS | تصدير Excel |
| CSS Variables | نظام تصميم متكيّف (فاتح/داكن) |

---

## الترخيص

© 2025 الإدارة العامة لري الجيزة. جميع الحقوق محفوظة.

</div>
