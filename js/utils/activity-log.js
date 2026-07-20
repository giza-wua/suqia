// =====================================================================
// utils/activity-log.js
// سجل النشاط: يسجّل كل عملية دخول وكل إضافة/تعديل/حذف يقوم بها أي
// مستخدم في أي قسم من أقسام المنصة، في collection مستقل "activity_log"
// بقاعدة بيانات Firestore. يُعرض في تبويب الإعدادات لمن يملك صلاحية
// "مدير عام" فقط، كأداة مساءلة وشفافية بين المستخدمين.
//
// ملحوظة: التسجيل هنا "Best effort" — أي فشل في كتابة سجل النشاط لا
// يوقف العملية الأساسية نفسها (حفظ/حذف بيانات)، فقط يُسجَّل في console.
// =====================================================================

import { db } from '../services/firebase.js';
import { escapeHtml } from './ui-helpers.js';

const MODULE_LABELS = {
    auth: "تسجيل الدخول",
    masaqi: "المساقي",
    tickets: "البلاغات",
    members: "الأعضاء",
    news: "الأخبار",
    team: "المستخدمون",
    canal_tracking: "الترع",
    backup: "النسخ الاحتياطي",
};
const ACTION_ICONS = {
    login: "🔑", logout: "🚪", create: "➕", update: "✏️",
    delete: "🗑️", export: "⬇️", restore: "⬆️", import: "📥",
};
const ACTION_COLORS = {
    login: "info", logout: "muted", create: "success", update: "warning",
    delete: "danger", export: "success", restore: "warning", import: "info",
};

// module: 'auth' | 'masaqi' | 'tickets' | 'members' | 'news' | 'team' | 'canal_tracking' | 'backup'
// action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'export' | 'restore' | 'import'
export async function logActivity(module, action, description) {
    try {
        await db.collection("activity_log").add({
            username: window.currentUsername || "زائر",
            display_name: window.currentUserDisplayName || "زائر (بدون تسجيل دخول)",
            role: window.currentRole || "-",
            module, action, description,
            at: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.error("logActivity failed:", e);
    }
}

// ============ الاستماع المباشر لآخر 100 نشاط ============
// مُقيَّد للمدير العام فقط (يطابق قواعد أمان Firestore الجديدة).
let activityUnsub = null;
export function initActivityLogListener() {
    if (activityUnsub) return;
    activityUnsub = db.collection("activity_log").orderBy("at", "desc").limit(100).onSnapshot((snap) => {
        window.activityLogCache = [];
        snap.forEach(d => window.activityLogCache.push({ id: d.id, ...d.data() }));
        window._loaded.activity = true;
        renderActivityLog();
    }, (err) => console.error(err));
}
export function stopActivityLogListener() {
    if (activityUnsub) { activityUnsub(); activityUnsub = null; }
    window.activityLogCache = []; window._loaded.activity = false;
}

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
        const date = l.at?.toDate ? l.at.toDate() : null;
        return `<div class="activity-item">
            <div class="activity-icon activity-icon-${color}">${icon}</div>
            <div class="activity-body">
                <div class="activity-line"><b>${escapeHtml(l.display_name) || escapeHtml(l.username)}</b> ${escapeHtml(l.description) || ""}</div>
                <div class="activity-meta">${moduleLabel} • ${date ? timeAgo(date) : "..."}</div>
            </div>
        </div>`;
    }).join("");
}
