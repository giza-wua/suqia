// =====================================================================
// state.js
// الحالة المشتركة بين كل وحدات التطبيق (الكاش المحلي للبيانات، حالة
// التحميل، الرسوم البيانية، بيانات المستخدم الحالي).
//
// ملحوظة هامة: نفس أسلوب الملف الأصلي، يتم تخزين الحالة المشتركة على
// window بدل المتغيرات المحلية (let) لأن الكود الآن مقسم على عدة ملفات
// ES Modules مستقلة (كل ملف له Scope خاص به)، وكانت هذه المتغيرات في
// الملف الأصلي بمثابة متغيرات عامة (Global) لأن كل الكود كان في وحدة
// واحدة. هذا التغيير داخلي بالكامل ولا يؤثر على أي سلوك ظاهر للمستخدم،
// ولا على أسماء الـ collections أو الحقول أو الـ IDs/classes.
//
// هذا الملف يجب أن يتم تحميله أولًا (يتم استيراده من main.js قبل أي
// ملف آخر) لضمان تهيئة كل هذه القيم قبل استخدامها.
// =====================================================================

window.masaqiCache = [];
window.ticketsCache = [];
window.membersCache = [];
window.newsCache = [];
window.teamCache = [];
window.canalTrackingCache = [];
window.activityLogCache = [];

window._loaded = { masaqi: false, tickets: false, members: false, news: false, team: false, canals: false, activity: false };

// كاش الرسوم البيانية (Chart.js instances) — كان متغير let محلي في الملف الأصلي
window.charts = {};

// بيانات جلسة المستخدم الحالي — كانت متغيرات let محلية في الملف الأصلي
window.currentUserDisplayName = null;
window.currentUsername = null;
window.currentRole = null; // 'admin' | 'viewer'
