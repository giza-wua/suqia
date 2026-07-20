// =====================================================================
// utils/week-filter.js
// أداة مساعدة عامة لحساب حدود "الأسبوع الحالي" (من السبت إلى الجمعة)،
// تُستخدم لتحديد ما يظهر في لوحتي المنتفعين العامتين (الترع والمساقي)
// في الصفحة الرئيسية: لا تظهر إلا أعمال هذا الأسبوع فقط.
// =====================================================================

// تحويل نص تاريخ بصيغة YYYY-MM-DD إلى Date بالتوقيت المحلي (بدون أي
// مشاكل فروق توقيت قد تحدث عند استخدام new Date(string) مباشرة).
function parseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return null;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
}

// حدود الأسبوع الحالي: يبدأ السبت (Saturday) وينتهي الجمعة (Friday).
export function getCurrentWeekRange() {
    const now = new Date();
    const daysSinceSaturday = (now.getDay() + 1) % 7; // الأحد=0...السبت=6 في جافاسكريبت
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceSaturday);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { startOfWeek, endOfWeek };
}

// هل تاريخ نصي (YYYY-MM-DD) يقع ضمن الأسبوع الحالي؟
export function isDateInCurrentWeek(dateStr) {
    const date = parseLocalDate(dateStr);
    if (!date) return false;
    const { startOfWeek, endOfWeek } = getCurrentWeekRange();
    return date >= startOfWeek && date <= endOfWeek;
}

// نص جاهز لعرض حدود الأسبوع الحالي للمنتفعين، مثل: "من 20 يونيو إلى 26 يونيو".
export function getCurrentWeekLabel() {
    const { startOfWeek, endOfWeek } = getCurrentWeekRange();
    const fmt = (d) => d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
    return `من ${fmt(startOfWeek)} إلى ${fmt(endOfWeek)}`;
}
