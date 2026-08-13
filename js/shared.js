// ══════════════════════════════════════════════════════════
//  منصة زمام الجيزة — js/shared.js (v1.0.2)
//  الشريط الموحَّد لكل صفحات لوحة الإدارة. المصادقة في auth.js — هنا
//  فقط التنقّل والمظهر.
//
//  إصلاحات هذا الإصدار (بناءً على ملاحظات مباشرة):
//  1) الشريط الجانبي كان بيختفي ويظهر بسرعة (Flicker) عند فتح أي صفحة،
//     لأنه كان بينتظر رد المصادقة (طلب شبكة) الأول قبل ما يُرسَم خالص.
//     الحل: renderAdminShell() بقت تُستدعى فوراً بمجرد تحميل الصفحة (من
//     غير أي بيانات مستخدم)، فيظهر الهيكل لحظياً، وبعدين تُستدعى تاني
//     بعد رد المصادقة لتحديث اسم المستخدم والعناصر الخاصة بالمسؤول فقط
//     — تحديث نص داخل هيكل ثابت أصلاً، مش ظهور/اختفاء للشريط نفسه.
//  2) أيقونات SVG حقيقية بدل الإيموجي (راجع js/icons.js).
//  3) إعادة تنظيم القائمة حسب الوظيفة الفعلية بدل التصنيف العشوائي:
//     المساقي + الترع + المصارف مع بعض (كلها "شبكة الري والصرف")،
//     الكباري + الآبار مع بعض ("المنشآت")، الخريطة + الأخبار في الآخر،
//     والفريق/المستخدمين بقى تبويب جوه الإعدادات بدل عنصر قائمة منفصل.
// ══════════════════════════════════════════════════════════

import { logoutUser } from "./auth.js";
import { initNotifications, toggleNotificationsPanel, removeNotification, clearAllNotifications } from "./utils/notifications.js";
import { APP_NAME, APP_VERSION } from "./version.js";
import { icon } from "./icons.js";

window.toggleNotificationsPanel = toggleNotificationsPanel;
window.removeNotification = removeNotification;
window.clearAllNotifications = clearAllNotifications;

// ============ قائمة تنقّل لوحة الإدارة الموحَّدة ============
export const NAV_ITEMS = [
    { key: "dashboard", href: "dashboard.html", label: "لوحة التحكم", icon: "dashboard", section: "الرئيسية" },

    { key: "tickets", href: "tickets.html", label: "البلاغات الميدانية", icon: "mail", section: "شبكة الري والصرف" },
    { key: "masaqi", href: "masaqi.html", label: "المساقي المائية", icon: "droplet", section: "شبكة الري والصرف" },
    { key: "canals", href: "canals.html", label: "الترع", icon: "tractor", section: "شبكة الري والصرف" },
    { key: "drains", href: "drains.html", label: "المصارف", icon: "waves", section: "شبكة الري والصرف" },
    { key: "members", href: "members.html", label: "أعضاء الروابط", icon: "users", section: "شبكة الري والصرف" },

    { key: "bridges", href: "bridges.html", label: "الكباري", icon: "bridge", section: "المنشآت" },
    { key: "wells", href: "wells.html", label: "الآبار الجوفية", icon: "well", section: "المنشآت" },

    { key: "map", href: "map.html", label: "الخريطة الموحَّدة", icon: "map", section: "عام" },
    { key: "news", href: "news.html", label: "الأخبار", icon: "megaphone", section: "عام" },

    { key: "settings", href: "settings.html", label: "الإعدادات", icon: "settings", section: "الإدارة" },
];

// ============ الوضع الليلي (نفس منطق زمام) ============
export function initTheme() {
    try {
        const saved = localStorage.getItem("zimam_theme");
        if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
    } catch (e) { /* ignore */ }
}
export function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
    try { localStorage.setItem("zimam_theme", isDark ? "light" : "dark"); } catch (e) { /* ignore */ }
}

// ============ توليد قائمة التنقّل الموحَّدة ============
// تُستدعى مرتين من كل صفحة إدارة: مرة فورية بدون profile (يظهر الهيكل
// لحظياً)، ومرة تانية بـ profile الحقيقي بعد رد المصادقة (تحديث نص
// بسيط داخل نفس الهيكل، بدون أي وميض).
export function renderAdminShell(activeKey, profile = null) {
    const container = document.getElementById("admin-shell");
    if (!container) return;

    if (!document.title.includes(APP_VERSION)) document.title = `${document.title} — ${APP_VERSION}`;

    const sections = [...new Set(NAV_ITEMS.map(i => i.section))];
    const sidebarHtml = sections.map(section => `
        <div class="sb-section">${section}</div>
        ${NAV_ITEMS.filter(i => i.section === section && (!i.minRole || profile?.role === i.minRole)).map(i => `
            <a class="nav-item ${i.key === activeKey ? "active" : ""}" href="${i.href}"><span class="nav-item-icon">${icon(i.icon, 19)}</span>${i.label}</a>
        `).join("")}
    `).join("");

    container.innerHTML = `
        <aside class="sidebar" id="sidebar">
            <div class="sb-brand">
                <img src="../assets/branding/amana-logo.png" alt="شعار الأمانة العامة" style="width:36px;height:36px;object-fit:contain;" />
                <div class="sb-brand-text"><h2>${APP_NAME}</h2><span>محافظة الجيزة &nbsp;<em class="sb-version">v${APP_VERSION}</em></span></div>
            </div>
            <nav class="sb-nav">${sidebarHtml}</nav>
        </aside>
        <header class="topbar">
            <button class="tb-menu-btn" id="tb-menu-btn" aria-label="القائمة">${icon("menu", 20)}</button>
            <div class="tb-user">${profile ? `${profile.display_name || profile.name || profile.username} · ${profile.role}` : ""}</div>
            <div class="tb-actions">
                <div class="notif-bell-wrap show" id="notif-bell-wrap">
                    <button class="bell-btn" id="notif-bell-btn" onclick="toggleNotificationsPanel()" title="الإشعارات" aria-label="الإشعارات">
                        ${icon("bell", 18)}<span class="notif-badge" id="notif-badge" style="display:none;">0</span>
                    </button>
                    <div class="notif-panel" id="notif-panel">
                        <div class="notif-panel-head">
                            <span>${icon("bell", 15)} الإشعارات</span>
                            <button class="notif-clear-all-btn" onclick="clearAllNotifications()">مسح الكل</button>
                        </div>
                        <div class="notif-panel-list" id="notif-panel-list"></div>
                    </div>
                </div>
                <button class="tb-btn" onclick="window.zimamToggleTheme()" title="تبديل المظهر">${icon("moon", 17)}</button>
                <button class="tb-btn" onclick="window.zimamLogout()" title="تسجيل الخروج">${icon("logout", 17)}</button>
            </div>
        </header>
        <nav class="mobile-bottom-nav">
            ${NAV_ITEMS.slice(0, 5).map(i => `<a class="mbn-item ${i.key === activeKey ? "active" : ""}" href="${i.href}"><span class="mbn-item-icon">${icon(i.icon, 20)}</span>${i.label}</a>`).join("")}
        </nav>`;

    document.getElementById("tb-menu-btn")?.addEventListener("click", () => {
        document.getElementById("sidebar")?.classList.toggle("open");
    });
    if (profile) initNotifications();
}

// روابط مختصرة تستخدمها أزرار الـ onclick المُولَّدة أعلاه
window.zimamToggleTheme = toggleTheme;
window.zimamLogout = logoutUser;
