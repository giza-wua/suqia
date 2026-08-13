# بنية الواجهة الأمامية

## الصفحات (`admin/*.html` + `index.html`)

| الصفحة | الوصول | الوصف |
|---|---|---|
| `index.html` | عام | الواجهة الرئيسية: لوحة أخبار، لوحة أعمال المساقي/الترع الأسبوعية، نموذج تسجيل بلاغ |
| `admin/login.html` | عام | تسجيل الدخول — يحوّل تلقائياً لـ `setup.html` لو النظام لسه مش مُعَدّ |
| `admin/setup.html` | عام (مرة واحدة بس) | إنشاء أول حساب مدير عام |
| `admin/dashboard.html` | فريق العمل | مؤشرات عامة + تنبيهات صيانة |
| `admin/masaqi.html`, `canals.html`, `bridges.html`, `wells.html`, `drains.html`, `members.html`, `news.html`, `tickets.html` | فريق العمل | إدارة كل قسم بيانات |
| `admin/map.html` | فريق العمل | عرض كل المواقع (ترع/كباري/آبار/مصارف) على خريطة |
| `admin/settings.html` | فريق العمل (بعض الأقسام admin فقط) | إدارة الفريق، النسخ الاحتياطي، تغيير كلمة المرور، حالة النظام |

## `js/data/*.js` — نمط موحَّد لكل قسم بيانات

كل ملف بيصدّر نفس الشكل تقريباً: `save<X>()`, `edit<X>Trigger(id)`, `cancelEdit<X>()`, `delete<X>(id)`, `render<X>()`, `init<X>Listener()`. الصفحة المرتبطة بتستدعي الدوال دي مباشرة من `onclick`.

**التحديث الدوري:** `init<X>Listener()` بيستخدم `pollCollection()` من `js/services/api.js` (بدل `onSnapshot` القديمة) — بيسحب البيانات كل 20 ثانية ويحدّث الكاش المحلي (`window.<x>Cache`) ثم يعيد الرسم.

**camelCase مقابل snake_case:** `bridges.js`, `wells.js`, `drains.js` فيهم دالة `toApi()` بتحوّل من أسماء الحقول في الفورم (camelCase، إرث من تطبيق "سُقيا" القديم) لأسماء أعمدة D1 (snake_case). أي حقل جديد يتضاف لازم يتضاف في الاتنين (الفورم + `toApi()`).

## `js/utils/*.js` — أدوات مشتركة

| الملف | الوظيفة |
|---|---|
| `ui-helpers.js` | مساعدات عرض عامة: صفوف تحميل/فراغ، قوائم منسدلة، تفعيل/تعطيل الأزرار |
| `modal.js` | `showAlert()` / `showConfirm()` — ديالوجات بديلة عن `alert()`/`confirm()` الأصلية |
| `toast.js` | رسائل تنبيه سريعة تختفي تلقائياً |
| `gps.js` | `captureGPS()` (حقل موقع واحد) و`captureGPSSeparate()` (حقلي خط عرض/طول منفصلين) |
| `identity.js` | تطبيع اسم المستخدم/رقم الموبايل المصري لصيغة موحَّدة |
| `week-filter.js` | حساب "هل التاريخ ده في الأسبوع الحالي؟" للوحة الأعمال الأسبوعية |
| `notifications.js` | مركز إشعارات (جرس 🔔) لبلاغات المزارعين الجديدة |
| `pdf-export.js` / `excel-export.js` | تصدير الجداول لملفات PDF/Excel من المتصفح مباشرة |
| `activity-log.js` | **no-op عمداً** — السيرفر بقى بيسجّل النشاط بنفسه، مش الكلاينت |

## `js/services/api.js` — طبقة الاتصال بالـ API

`apiGet/apiPost/apiPut/apiDelete` فوق `fetch` عادي، و`pollCollection(path, callback, intervalMs)` كبديل لـ `onSnapshot`. كل الأخطاء بترجع `Error` فيها `.message` بالعربي و`.friendly = true` (عشان نعرف نعرضها للمستخدم مباشرة بدل رسالة عامة).

## `js/auth.js` — حالة الجلسة على الكلاينت

`requireAuth(minRole)` بتتنادى في أول كل صفحة إدارة، بتتأكد من الجلسة عبر `/api/auth/me`، وبتحط `window.currentRole`/`window.currentUid`/`window.currentUsername` عشان باقي الكود يستخدمهم (`isAdmin()`, `isDataEditor()`).

## CSS (`css/*.css`)

| الملف | المحتوى |
|---|---|
| `01-tokens.css` | متغيرات التصميم (ألوان، مسافات، ظلال، `--transition`) |
| `02-components.css` | مكوّنات عامة: الشريط الجانبي، الديالوجات، المودالات، شاشة الدخول/الإعداد |
| `03-app-components.css` | مكوّنات خاصة بلوحة التحكم: الجداول، البادجات، الأزرار |
| `04-public-layout.css` | تنسيق الواجهة العامة (`index.html`) بس |
| `05-responsive.css` | نقاط الكسر (breakpoints) للموبايل |
