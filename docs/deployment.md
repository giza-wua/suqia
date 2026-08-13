# دليل النشر الكامل

النشر الفعلي لهذا المشروع عبر **Cloudflare Pages + D1** (اتأكَّد من صاحب المشروع مباشرة). الدليل ده بيغطي الطريقة دي بس — كان فيه قبل كده طريقة بديلة كـ Cloudflare Worker، اتشالت في 1.1.16 لأن المشروع مش بيستخدمها، وإبقاؤها كانت بتسبب لبس (وباجات حقيقية، راجع `docs/changelog.md` رقم 1.1.14/1.1.16).

## المتطلبات

- حساب Cloudflare (مجاني كفاية لحجم الاستخدام ده).
- الريبو مربوط بـ GitHub (أسهل طريقة)، أو Node.js على جهازك لو هتستخدم `wrangler` مباشرة لخطوات D1.

## الخطوات

1. **جهّز قاعدة D1 أولاً** (مرة واحدة بس):
   - من جهازك: `npm install -g wrangler` ثم `wrangler login` ثم `wrangler d1 create zimam-giza`، وانسخ الـ `database_id` من الناتج والصقه في `wrangler.toml` مكان `REPLACE_AFTER_wrangler_d1_create` (مش إلزامي فعلياً لنشر Pages نفسه، لكن مفيد يفضل موثَّق في الريبو).
   - أو من Cloudflare Dashboard مباشرة: **Storage & Databases** → **D1 SQL Database** → **Create Database** باسم `zimam-giza`.
   - رتّب الجداول: `wrangler d1 execute zimam-giza --remote --file=./schema.sql`، أو من Dashboard → قاعدة `zimam-giza` → Console → الصق محتوى `schema.sql` كامل → نفّذ.

2. **اربط المشروع بـ Cloudflare Pages:**
   - Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → اختار الريبو بتاعك.
   - إعدادات البناء: **Framework preset: None**، **Build command: (فاضي)**، **Build output directory: `/`**.
   - `functions/api/[[path]].js` هيتكشف تلقائياً — أي طلب مساره `/api/**` هيتوجّه له، وأي حاجة تانية (`index.html`, `css/`, `js/`, `admin/*`) بتتقدَّم كملف ثابت عادي من غير أي كود إضافي.

3. **اربط قاعدة D1 بمشروع الـ Pages:**
   - Settings → **Functions** → **D1 database bindings** → أضف binding بالاسم بالظبط `DB` → اختار قاعدة `zimam-giza`.

4. **أضف سر الجلسة:**
   - Settings → **Environment variables** → أضف `SESSION_SECRET` (نوعه **Secret**) بسلسلة عشوائية طويلة (30+ حرف)، تتولّد مرة واحدة وتتحفظ بأمان.

5. **Retry deployment** (أو ادفع commit جديد لو أول مرة).

6. افتح لينك المشروع (`<اسمه>.pages.dev` أو دومين مخصَّص) → `/admin/login.html` → هيحوّلك تلقائياً لصفحة الإعداد الأول (`setup.html`) لإنشاء حساب المدير العام.

**ملحوظة:** متضيفش ملف `_worker.js` في جذر المشروع — لو موجود، Cloudflare بتتجاهل مجلد `functions/` بالكامل وتستخدمه هو لوحده بدل التوجيه العادي.

## دومين مخصَّص

Cloudflare Dashboard → اختار مشروع الـ Pages → **Custom domains** → Add → اختار الدومين بتاعك (لازم يكون الدومين مُدار من Cloudflare نفسها كـ DNS).

## تحديث النشر لاحقاً

- أي `push`/`commit` جديد على الفرع الأساسي بيعمل نشر تلقائي.
- تعديلات على `schema.sql` (زي إضافة عمود جديد) **لازم تتنفَّذ يدوياً** في كونسول D1 — مفيش "migration" تلقائية؛ النشر بينشر كود الموقع بس، مش تغييرات قاعدة البيانات.
- تعديلات على منطق الـ API بتتعمل مباشرة في `functions/api/[[path]].js` (مصدر الحقيقة الوحيد، راجع `docs/architecture.md`) — مفيش خطوة "إعادة تجميع" منفصلة، الملف بيتنشر زي ما هو.

## النسخ الاحتياطي والاستعادة بعد النشر

راجع `docs/architecture.md` قسم "النسخ الاحتياطي والاستيراد"، أو ببساطة: صفحة الإعدادات فيها زرار تنزيل/استيراد لكل قسم بيانات على حدة.
