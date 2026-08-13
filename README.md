# زِمام — نسخة Cloudflare فقط (بدون أي أثر لـ Firebase)

**الإصدار: 1.2.2** — راجع `docs/changelog.md` لسجل كل الإصدارات وتفاصيلها.

مجلد واحد، فيه التطبيق كامل (الموقع + الـ API + قاعدة البيانات)، جاهز يترفع على Cloudflare فقط. مفيش بيانات جواه — هتضيف بياناتك بنفسك بعد النشر.

النشر الفعلي عبر **Cloudflare Pages + D1** — راجع `docs/deployment.md` للخطوات الكاملة.

## إيه اللي جوّه المجلد

```
├── index.html, admin/, css/, js/, assets/, manifest.json, sw.js, tools/
│     ↑ الموقع نفسه، في جذر المشروع مباشرة
├── functions/api/[[path]].js  ← نقطة دخول الـ API — المصدر الوحيد لمنطق الـ API كله
├── wrangler.toml       ← بس لأوامر wrangler d1 CLI (إنشاء القاعدة/تنفيذ schema.sql)
├── schema.sql          ← تركيب قاعدة البيانات (فاضية، من غير تعليقات)
├── .assetsignore        ← يمنع functions/scripts/schema.sql/docs من إنها تتقدَّم كملفات عامة
├── docs/                ← التوثيق الكامل (راجع docs/README.md)
└── scripts/
    └── create-first-admin.js   ← بديل يدوي لشاشة الإعداد الأول
```

الموقع والـ API مع بعض في نفس مشروع الـ Pages — مفيش تقسيمة Backend/Frontend في مشروعين منفصلين.

## خطوات النشر (مختصرة)

1. جهّز قاعدة D1: `wrangler d1 create zimam-giza` ثم `wrangler d1 execute zimam-giza --remote --file=./schema.sql` (أو من Cloudflare Dashboard مباشرة).
2. اربط الريبو بمشروع Cloudflare Pages جديد (Build command فاضي، Build output directory: `/`).
3. من Settings: اربط D1 binding باسم `DB`، وأضف `SESSION_SECRET` كمتغيّر Secret.
4. افتح `/admin/login.html` بعد النشر — هيحوّلك تلقائياً لصفحة الإعداد الأول لإنشاء حساب المدير العام.

الشرح الكامل خطوة بخطوة في **`docs/deployment.md`**.

## إزاي تضيف بياناتك

القاعدة فاضية عن قصد — 3 طرق: إدخال يدوي، استيراد Excel (المساقي والأعضاء)، أو استعادة نسخة احتياطية (لكل قسم على حدة أو دفعة واحدة) من صفحة الإعدادات.

## التوثيق الكامل

كل التفاصيل (البنية المعمارية، شرح قاعدة البيانات، مرجع الـ API، بنية الواجهة، الأمان، حل المشاكل الشائعة، سجل الإصدارات) موجودة في مجلد **`docs/`** — ابدأ من `docs/README.md`.
