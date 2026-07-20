// =====================================================================
// navigation.js
// التنقل بين الواجهات الرئيسية (واجهة المزارع / تسجيل الدخول / لوحة
// الإدارة) والتنقل بين تبويبات لوحة الإدارة (البلاغات، المساقي،
// الأعضاء، الأخبار، التقارير، الإعدادات).
// =====================================================================

import { applyPermissions, updateAdminGreeting, isAdmin } from './auth.js';
import { renderReports } from './reports.js';
import { renderNewsCards } from './data/news.js';
import { renderPublicCanalBoard } from './data/canal-tracking.js';
import { renderPublicMasaqiBoard } from './data/masaqi.js';
import { showAlert } from './utils/modal.js';
import { renderSystemHealth } from './data/backup.js';
import { renderActivityLog } from './utils/activity-log.js';
import { setNotificationsBellVisible } from './utils/notifications.js';

export function switchView(view) {
    document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
    document.getElementById("section-" + view).classList.add("active");
    const btn = document.getElementById("btn-login-nav");
    const mobileNav = document.getElementById("mobile-bottom-nav");
    const whatsappFab = document.getElementById("whatsapp-fab");
    whatsappFab?.classList.toggle("show", view === "farmer-view");
    // الجرس يخص إشعارات فريق العمل فقط (بلاغات ميدانية)، فيظهر في لوحة
    // الإدارة فقط ويختفي في واجهة المزارع/شاشة الدخول.
    setNotificationsBellVisible(view === "admin-dashboard");
    if (view === "admin-dashboard") {
        btn.textContent = "🚪 تسجيل الخروج";
        btn.className = "nav-btn danger";
        btn.setAttribute("onclick", "logoutAdmin()");
        applyPermissions();
        updateAdminGreeting();
        mobileNav?.classList.add("show");
        setTimeout(renderReports, 400);
    } else if (view === "farmer-view") {
        btn.textContent = "🔑 دخول الإدارة";
        btn.className = "nav-btn";
        btn.setAttribute("onclick", "switchView('login-view')");
        mobileNav?.classList.remove("show");
        renderNewsCards();
        renderPublicCanalBoard();
        renderPublicMasaqiBoard();
    } else {
        btn.textContent = "🔑 دخول الإدارة";
        btn.className = "nav-btn";
        btn.setAttribute("onclick", "switchView('login-view')");
        mobileNav?.classList.remove("show");
    }
}

export function switchAdminTab(tab) {
    if (tab === "settings" && !isAdmin()) { showAlert("ليس لديك صلاحية الوصول لهذه الصفحة."); tab = "tickets"; }
    document.querySelectorAll(".admin-tab-content").forEach(c => c.style.display = "none");
    document.querySelectorAll(".sidebar .menu-item").forEach(i => i.classList.remove("active"));
    document.querySelectorAll(".mobile-bottom-nav .mnav-item").forEach(i => i.classList.remove("active"));
    const tabEl = document.getElementById("admin-tab-" + tab);
    if (tabEl) tabEl.style.display = "block";
    document.getElementById("tab-btn-" + tab)?.classList.add("active");
    document.getElementById("mnav-btn-" + tab)?.classList.add("active");
    if (tab === "reports") setTimeout(renderReports, 150);
    if (tab === "settings") { renderSystemHealth(); renderActivityLog(); }
    const main = document.querySelector(".main-content");
    if (main && window.innerWidth < 992) main.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============ التبويبات الفرعية داخل تبويب الإعدادات ============
// (عام / النسخ الاحتياطي / سجل النشاط / المستخدمون) — لتقليل الازدحام
// البصري بدلًا من عرض كل البطاقات مكدَّسة فوق بعضها.
export function switchSettingsSubtab(name) {
    document.querySelectorAll(".settings-subtab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".settings-subtab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(`sst-panel-${name}`)?.classList.add("active");
    document.getElementById(`sst-btn-${name}`)?.classList.add("active");
    if (name === "general") renderSystemHealth();
    if (name === "activity") renderActivityLog();
}
