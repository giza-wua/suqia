# مرجع الـ API

كل المسارات تحت `/api/`. الردود JSON. الأخطاء بترجع `{"error": "رسالة عربية"}` مع كود حالة HTTP مناسب (400/401/403/404/429/500).

## الإعداد الأول (تشتغل مرة واحدة بس)

| المسار | الطريقة | الوصف |
|---|---|---|
| `/api/setup/status` | GET | `{needsSetup: true/false}` — بترجع true بس لو جدول users فاضي تماماً |
| `/api/setup` | POST | `{display_name, username, password}` — بتنشئ أول مدير عام وتسجّل دخوله فوراً. بترفض (403) لو فيه أي مستخدم موجود بالفعل — قفل تلقائي دائم بعد أول استخدام. |

## المصادقة

| المسار | الطريقة | الوصول | الوصف |
|---|---|---|---|
| `/api/auth/login` | POST | عام | `{username, password}` → يرجّع بروفايل المستخدم ويحط جلسة (cookie) |
| `/api/auth/logout` | POST | عام | يمسح الجلسة |
| `/api/auth/me` | GET | يحتاج جلسة | بيانات المستخدم الحالي |
| `/api/auth/change-password` | PUT | يحتاج جلسة (أي صلاحية) | `{currentPassword, newPassword}` — أي مستخدم يغيّر كلمة مروره هو بنفسه |

## الموديولات القياسية (نفس الشكل لكل واحدة)

بتنطبق على: `masaqi`, `bridges`, `wells`, `drains`, `members`, `news`.

| المسار | الطريقة | الصلاحية المطلوبة |
|---|---|---|
| `/api/<collection>` | GET | `viewer` فأعلى |
| `/api/<collection>` | POST (إنشاء) | `editor` فأعلى |
| `/api/<collection>/:id` | PUT (تعديل) | `editor` فأعلى |
| `/api/<collection>/:id` | DELETE | `editor` فأعلى |

## الترع (فيها إضافة: سجل التطهير)

| المسار | الطريقة | الصلاحية |
|---|---|---|
| `/api/canals` | GET / POST | `viewer` / `editor` |
| `/api/canals/count` | GET | `viewer` — عدد صفوف الترع بدون تحميل أي بيانات تفصيلية، أداة تشخيص سريعة |
| `/api/canals/:id` | PUT / DELETE | `editor` |
| `/api/canals/:id/history` | GET | `viewer` |
| `/api/canals/:id/history` | POST | `editor` |

## البلاغات (كتابة عامة)

| المسار | الطريقة | الصلاحية | ملاحظات |
|---|---|---|---|
| `/api/tickets` | POST | **عام، بدون تسجيل دخول** | فيه حماية سبام بالـ IP (cooldown دقيقة واحدة) |
| `/api/tickets` | GET | `viewer` | لفريق العمل بس |
| `/api/tickets/:id/status` | PUT | `editor` | تحديث حالة البلاغ |

## سجل الأنشطة (admin فقط)

| المسار | الطريقة | الوصف |
|---|---|---|
| `/api/activity-log` | GET | آخر 100 نشاط، مرتَّبة الأحدث أولاً |

## منطقة الخطر (admin فقط)

| المسار | الطريقة | الوصف |
|---|---|---|
| `/api/<collection>/wipe` | POST | `{confirm: "<collection>"}` — يمسح كل سجلات المجموعة نهائياً. بيرفض (400) لو `confirm` مش مطابق بالظبط لاسم المجموعة. المجموعات المسموحة: masaqi, canals, bridges, wells, drains, members, news, tickets — `users` و`activity_log` مستثنيان عمداً. |

## الفريق (المستخدمين — admin فقط بالكامل)

| المسار | الطريقة | الوصف |
|---|---|---|
| `/api/users` | GET / POST | عرض الفريق / إضافة مستخدم جديد |
| `/api/users/:id/role` | PUT | تغيير الصلاحية |
| `/api/users/:id/reset-password` | PUT | تعيين كلمة مرور جديدة يدوياً |
| `/api/users/:id` | DELETE | إبطال صلاحية المستخدم |

## ملاحظات عامة للتطوير

- كل الـ routes بتستدعي `requireRole(request, env, minRole)` (أول جزء من `functions/api/[[path]].js`) كأول سطر — لو رجّعت `Response` (يعني مفيش صلاحية)، الـ route بيرجّعها فوراً.
- الإنشاء (`POST`) في الموديولات القياسية بيقبل `id` اختياري في جسم الطلب — لو موجود، بيستخدم UPSERT (تحديث لو موجود، إنشاء لو مش موجود) بدل توليد id عشوائي. ده مصمَّم عشان الاستعادة من نسخة احتياطية تحافظ على نفس الـ IDs الأصلية.
- سجل الأنشطة (`activity_log`) بيتسجَّل تلقائياً من كل route كتابة (`create`/`update`/`delete`)، مش محتاج أي كود إضافي من الكلاينت.
