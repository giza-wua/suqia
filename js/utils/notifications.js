// =====================================================================
// utils/notifications.js
// مركز إشعارات حقيقي (أيقونة جرس 🔔 + قائمة منسدلة) بدل الاعتماد فقط
// على تغيير عنوان التاب (الطريقة القديمة في 1.7.0 كانت تُصفَّر تلقائياً
// بمجرد فتح تبويب "البلاغات"، وهو سلوك "ثابت" لا يتحكم فيه المستخدم).
//
// الآن: كل إشعار (حالياً فقط "بلاغ ميداني جديد") يُضاف كعنصر مستقل في
// قائمة تظهر تحت الجرس، ويبقى موجوداً فيها حتى يمسحه المستخدم بنفسه —
// إما عنصر واحد (زر ✕ بجانبه) أو الكل دفعة واحدة (زر "مسح الكل").
// القائمة تُحفَظ في localStorage فتبقى موجودة حتى بعد تحديث الصفحة.
// =====================================================================

const STORAGE_KEY = "zimam_notifications";
const MAX_NOTIFICATIONS = 30;

let items = [];

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        items = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(items)) items = [];
    } catch (e) {
        items = [];
    }
}

function saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* ignore */ }
}

function escapeHtmlLocal(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function timeAgoShort(iso) {
    const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return "الآن";
    if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} دقيقة`;
    if (diffSec < 86400) return `منذ ${Math.floor(diffSec / 3600)} ساعة`;
    return `منذ ${Math.floor(diffSec / 86400)} يوم`;
}

// ============ إضافة إشعار جديد ============
// icon: رمز تعبيري صغير يظهر بجانب النص (مثلاً "📩" لبلاغ جديد).
export function addNotification(text, icon = "📩") {
    items.unshift({ id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, text, icon, at: new Date().toISOString() });
    if (items.length > MAX_NOTIFICATIONS) items.length = MAX_NOTIFICATIONS;
    saveToStorage();
    renderNotifications();
}

export function removeNotification(id) {
    items = items.filter((n) => n.id !== id);
    saveToStorage();
    renderNotifications();
}

export function clearAllNotifications() {
    items = [];
    saveToStorage();
    renderNotifications();
}

export function toggleNotificationsPanel() {
    const panel = document.getElementById("notif-panel");
    if (!panel) return;
    panel.classList.toggle("open");
}

function closePanel() {
    document.getElementById("notif-panel")?.classList.remove("open");
}

// إغلاق القائمة عند الضغط في أي مكان خارجها — تجربة استخدام معتادة
// لأي قائمة منسدلة (Dropdown)، بدون الحاجة لزر "إغلاق" منفصل.
document.addEventListener("click", (e) => {
    const wrap = document.getElementById("notif-bell-wrap");
    if (wrap && !wrap.contains(e.target)) closePanel();
});

// ============ عرض الجرس + القائمة ============
export function renderNotifications() {
    const badge = document.getElementById("notif-badge");
    if (badge) {
        if (items.length > 0) {
            badge.style.display = "flex";
            badge.textContent = items.length > 9 ? "9+" : String(items.length);
        } else {
            badge.style.display = "none";
        }
    }
    const list = document.getElementById("notif-panel-list");
    if (!list) return;
    if (items.length === 0) {
        list.innerHTML = '<div class="notif-empty">لا توجد إشعارات جديدة.</div>';
        return;
    }
    list.innerHTML = items.map((n) => `
        <div class="notif-item">
            <span class="notif-item-icon">${n.icon}</span>
            <div class="notif-item-body">
                <div class="notif-item-text">${escapeHtmlLocal(n.text)}</div>
                <div class="notif-item-time">${timeAgoShort(n.at)}</div>
            </div>
            <button class="notif-item-dismiss" onclick="removeNotification('${n.id}')" title="مسح هذا الإشعار" aria-label="مسح">✕</button>
        </div>
    `).join("");
}

// يُستدعى مرة واحدة عند تحميل الصفحة (main.js) لاسترجاع أي إشعارات
// محفوظة من قبل وعرضها فوراً.
export function initNotifications() {
    loadFromStorage();
    renderNotifications();
}

// ============ إظهار/إخفاء الجرس حسب الواجهة الحالية ============
// الإشعارات (حالياً بلاغات ميدانية) تخص أعضاء الفريق فقط، فيظهر الجرس
// في لوحة الإدارة فقط، ويختفي في واجهة المزارع/شاشة الدخول.
export function setNotificationsBellVisible(visible) {
    document.getElementById("notif-bell-wrap")?.classList.toggle("show", !!visible);
    if (!visible) closePanel();
}
