// =====================================================================
// utils/theme.js
// التحكم في مظهر المنصة (الوضع الفاتح / الداكن). التبديل فوري (بدون
// إعادة تحميل الصفحة) عبر إضافة/إزالة data-theme="dark" على <html>،
// ويُحفظ الاختيار في localStorage ليُطبَّق تلقائياً في الزيارات القادمة.
//
// ملحوظة: يوجد سكريبت صغير مطابق في أعلى <head> بملف index.html يطبّق
// المظهر المحفوظ قبل رسم الصفحة مباشرة (لمنع وميض لحظي بالمظهر الافتراضي)،
// وهذا الملف هو المسؤول عن التبديل التفاعلي بعد تحميل الصفحة.
// =====================================================================

const THEME_KEY = "zimam_theme";

function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyThemeUI(theme) {
    const label = document.getElementById("theme-status-label");
    if (label) label.textContent = theme === "dark" ? "🌙 الوضع الداكن مفعّل" : "☀️ الوضع الفاتح مفعّل";
    const navBtn = document.getElementById("navbar-theme-toggle");
    if (navBtn) navBtn.textContent = theme === "dark" ? "☀️" : "🌙";
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute("content", theme === "dark" ? "#12181a" : "#0f4c46");
}

// تُستدعى مرة واحدة عند تحميل الصفحة (من main.js) لمزامنة واجهة زر
// التبديل مع المظهر الذي طُبِّق مسبقاً بواسطة سكريبت <head>.
export function initTheme() {
    applyThemeUI(currentTheme());
}

// تُستدعى من زر التبديل في تبويب الإعدادات — تبديل فوري + حفظ الاختيار.
export function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    if (next === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    applyThemeUI(next);
}
