// =====================================================================
// utils/activity-log.js — الكتابة (logActivity) بقت no-op عمداً لأن
// السيرفر بقى بيسجّل النشاط بنفسه كجزء من كل عملية (راجع
// دالة logActivity في functions/api/[[path]].js). لكن العرض في تبويب
// الإعدادات (سجل النشاط) لسه موجود ومحتاج polling عادي بدل onSnapshot
// القديم — نفس نمط باقي المنصة.
// =====================================================================

import { apiGet, pollCollection } from '../services/api.js';
import { escapeHtml } from './ui-helpers.js';

export function logActivity(_module, _action, _description) {
    // intentionally no-op — راجع دالة logActivity في functions/api/[[path]].js
}

const MODULE_LABELS = {
    auth: "تسجيل الدخول", masaqi: "المساقي", tickets: "البلاغات", members: "الأعضاء",
    news: "الأخبار", team: "المستخدمون", canals: "الترع", bridges: "الكباري",
    wells: "الآبار", drains: "المصارف", backup: "النسخ الاحتياطي",
};
const ACTION_ICONS = {
    login: "🔑", logout: "🚪", create: "➕", update: "✏️",
    delete: "🗑️", export: "⬇️", restore: "⬆️", import: "📥",
};
const ACTION_COLORS = {
    login: "info", logout: "muted", create: "success", update: "warning",
    delete: "danger", export: "success", restore: "warning", import: "info",
};

function timeAgo(date) {
    const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return "الآن";
    if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} دقيقة`;
    if (diffSec < 86400) return `منذ ${Math.floor(diffSec / 3600)} ساعة`;
    return date.toLocaleDateString("ar-EG") + " - " + date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

// ============ عرض سجل النشاط في تبويب الإعدادات ============
export function renderActivityLog() {
    const container = document.getElementById("activity-log-list");
    if (!container) return;
    if (!window._loaded?.activity) { container.innerHTML = '<div class="activity-empty">⏳ جاري تحميل سجل النشاط...</div>'; return; }
    const filter = document.getElementById("activity-log-filter")?.value || "";
    let data = window.activityLogCache || [];
    if (filter) data = data.filter(l => l.module === filter);
    if (data.length === 0) { container.innerHTML = '<div class="activity-empty">لا يوجد أي نشاط مسجل بعد.</div>'; return; }
    container.innerHTML = data.map(l => {
        const icon = ACTION_ICONS[l.action] || "📝";
        const color = ACTION_COLORS[l.action] || "muted";
        const moduleLabel = MODULE_LABELS[l.module] || l.module;
        const date = l.at ? new Date(l.at.replace(" ", "T") + "Z") : null; // "YYYY-MM-DD HH:MM:SS" من SQLite (UTC) → تاريخ حقيقي
        return `<div class="activity-item">
            <div class="activity-icon activity-icon-${color}">${icon}</div>
            <div class="activity-body">
                <div class="activity-line"><b>${escapeHtml(l.display_name) || escapeHtml(l.username)}</b> ${escapeHtml(l.description) || ""}</div>
                <div class="activity-meta">${moduleLabel} • ${date && !isNaN(date) ? timeAgo(date) : "..."}</div>
            </div>
        </div>`;
    }).join("");
}

// ============ التحديث الدوري (بديل onSnapshot)، مُقيَّد للمدير العام فقط ============
let stopPolling = null;
export function initActivityLogListener() {
    if (stopPolling) return;
    stopPolling = pollCollection('/activity-log', (rows) => {
        window.activityLogCache = rows;
        window._loaded.activity = true;
        renderActivityLog();
    });
}
export function stopActivityLogListener() {
    if (stopPolling) { stopPolling(); stopPolling = null; }
    window.activityLogCache = []; window._loaded.activity = false;
}
