// =====================================================================
// main.js
// نقطة الدخول الرئيسية للتطبيق (Entry Point).
//
// المسؤوليات:
//   1) استيراد كل الوحدات (modules) اللازمة لتشغيل التطبيق.
//   2) ربط كل الدوال المُستخدمة في خصائص onclick/onchange/... داخل
//      ملف index.html (بما فيها القوالب الديناميكية في الجداول) على
//      window — لأن هذه الدوال لم تعد عامة (global) تلقائيًا بعد
//      تحويل الكود إلى ES Modules، وكل HTML attribute مثل
//      onclick="saveMasqa()" يحتاج أن يجد الدالة على window.
//   3) تشغيل الاستماع المباشر (onSnapshot) لكل collections في Firestore.
//   4) استرجاع جلسة المستخدم المحفوظة + اسم المستخدم المحفوظ.
//
// لإضافة قسم جديد بالمستقبل: أضف ملف الوحدة الجديد في js/data/ (أو في
// المكان المناسب)، استورد دواله هنا، وأضفها لقائمة window.assign إذا
// كانت تُستخدم داخل onclick/onchange في HTML. راجع README.md لمزيد
// من التفاصيل.
// =====================================================================

import './state.js';

import { attemptAdminLogin, logoutAdmin, initAuthListener } from './auth.js';
import { switchView, switchAdminTab, switchSettingsSubtab } from './navigation.js';

import {
    togglePasswordVisibility,
    updateWatercourseDropdown,
    handleMsNameOther,
    handleMemberRoleOther,
    toggleCollapse,
    updateOnlineStatus,
    debounce,
} from './utils/ui-helpers.js';
import { captureGPS } from './utils/gps.js';
import { exportTableToExcel, downloadExcelTemplate } from './utils/excel-export.js';
import { exportTableToPDF } from './utils/pdf-export.js';
import { initTheme, toggleTheme } from './utils/theme.js';
import { initActivityLogListener, stopActivityLogListener, renderActivityLog } from './utils/activity-log.js';
import { initNotifications, toggleNotificationsPanel, removeNotification, clearAllNotifications } from './utils/notifications.js';

import {
    saveMasqa,
    cancelEditMasqa,
    editMasqaTrigger,
    deleteMasqa,
    handleExcelImport,
    renderMasaqi,
    filterMasaqiByStatus,
    renderPublicMasaqiBoard,
    initMasaqiListener,
} from './data/masaqi.js';

import {
    submitFarmerTicket,
    updateTicketStatus,
    renderTickets,
    initTicketsListener,
    stopTicketsListener,
} from './data/tickets.js';

import {
    saveMember,
    cancelEditMember,
    editMemberTrigger,
    deleteMember,
    handleExcelImportMembers,
    renderMembers,
    initMembersListener,
    stopMembersListener,
} from './data/members.js';

import {
    saveNews,
    cancelEditNews,
    editNewsTrigger,
    deleteNews,
    initNewsListener,
} from './data/news.js';

import {
    addTeamMember,
    updateTeamRole,
    deleteTeamMember,
    resetTeamPassword,
    initTeamListener,
    stopTeamListener,
} from './data/team.js';

import {
    saveCanal,
    cancelEditCanal,
    editCanalTrigger,
    deleteCanal,
    importCanalsFromReference,
    renderCanalTracking,
    filterCanalsByStatus,
    renderCanalHistory,
    filterCanalHistorySelect,
    addCanalHistoryEntry,
    renderPublicCanalBoard,
    initCanalTrackingListener,
} from './data/canal-tracking.js';

import {
    exportDatabaseBackup,
    restoreDatabaseBackup,
    renderSystemHealth,
} from './data/backup.js';

// ============ ربط الدوال المطلوبة في خصائص onclick/onchange داخل HTML ============
Object.assign(window, {
    // التنقل
    switchView,
    switchAdminTab,
    switchSettingsSubtab,
    // المصادقة
    attemptAdminLogin,
    logoutAdmin,
    // أدوات عامة
    togglePasswordVisibility,
    updateWatercourseDropdown,
    handleMsNameOther,
    handleMemberRoleOther,
    captureGPS,
    toggleCollapse,
    exportTableToExcel,
    exportTableToPDF,
    downloadExcelTemplate,
    // المساقي
    saveMasqa,
    cancelEditMasqa,
    editMasqaTrigger,
    deleteMasqa,
    handleExcelImport,
    renderMasaqi,
    filterMasaqiByStatus,
    renderPublicMasaqiBoard,
    submitFarmerTicket,
    updateTicketStatus,
    renderTickets,
    // الأعضاء
    saveMember,
    cancelEditMember,
    editMemberTrigger,
    deleteMember,
    handleExcelImportMembers,
    renderMembers,
    // الأخبار
    saveNews,
    cancelEditNews,
    editNewsTrigger,
    deleteNews,
    // إدارة المستخدمين
    addTeamMember,
    updateTeamRole,
    deleteTeamMember,
    resetTeamPassword,
    // الترع
    saveCanal,
    cancelEditCanal,
    editCanalTrigger,
    deleteCanal,
    importCanalsFromReference,
    renderCanalTracking,
    filterCanalsByStatus,
    renderCanalHistory,
    filterCanalHistorySelect,
    addCanalHistoryEntry,
    renderPublicCanalBoard,
    // المظهر
    toggleTheme,
    // النسخ الاحتياطي والاستعادة
    exportDatabaseBackup,
    restoreDatabaseBackup,
    renderSystemHealth,
    // سجل النشاط
    renderActivityLog,
    // مركز الإشعارات (الجرس)
    toggleNotificationsPanel,
    removeNotification,
    clearAllNotifications,
});

// ============ نسخ مؤخَّرة (debounced) من دوال البحث في الجداول ============
// تُستخدم فقط في خصائص oninput لحقول البحث الحرة (وليس الفلاتر
// المنسدلة أو أي استدعاء آخر) — راجع ملاحظة debounce() في ui-helpers.js.
Object.assign(window, {
    renderMasaqiDebounced: debounce(renderMasaqi),
    renderTicketsDebounced: debounce(renderTickets),
    renderMembersDebounced: debounce(renderMembers),
    renderCanalTrackingDebounced: debounce(renderCanalTracking),
    filterCanalHistorySelectDebounced: debounce(filterCanalHistorySelect),
});

// ============ المستمعات المباشرة + تجهيز التطبيق عند تحميل الصفحة ============
// بيانات عامة (يحتاجها أي زائر بدون تسجيل دخول: المساقي، الترع،
// الأخبار) تُستمع فوراً. أما البيانات الخاصة بأعضاء الفريق (البلاغات،
// الأعضاء، المستخدمون، سجل النشاط) فتبدأ فقط بعد تأكيد تسجيل الدخول
// والصلاحية (حدث "zimam-auth-ready")، وتتوقف تماماً عند تسجيل الخروج —
// مطابقةً لقواعد أمان Firestore الجديدة ولحماية خصوصية البيانات.
document.addEventListener("zimam-auth-ready", (e) => {
    if (e.detail.signedIn) {
        initTicketsListener();
        initMembersListener();
        initTeamListener();
        initActivityLogListener();
    } else {
        stopTicketsListener();
        stopMembersListener();
        stopTeamListener();
        stopActivityLogListener();
    }
});

// ============ تسجيل Service Worker (دعم أساسي للعمل بلا اتصال) ============
// يخزّن هيكل التطبيق الثابت فقط (HTML/CSS/JS/الصور) محلياً على الجهاز،
// حتى تفتح الصفحة (شاشة الدخول على الأقل) حتى مع انقطاع الإنترنت
// تماماً — البيانات نفسها (Firestore) تبقى تحتاج اتصال فعلي دائماً،
// هذا فقط يمنع "صفحة بيضاء" عند انقطاع مؤقت في الميدان. لا يؤثر على
// أي سلوك آخر، ويفشل بصمت على المتصفحات التي لا تدعمه.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("Service worker registration failed:", e));
    });
}

window.addEventListener("DOMContentLoaded", () => {
    updateOnlineStatus();
    initTheme();
    initNotifications();

    // بيانات عامة — متاحة دائماً بدون تسجيل دخول
    initMasaqiListener();
    initNewsListener();
    initCanalTrackingListener();

    // يبدأ مراقبة Firebase Authentication، ويُطلق حدث zimam-auth-ready
    // فور تحديد حالة الدخول (سواء كان هناك جلسة محفوظة أم لا)
    initAuthListener();

    renderSystemHealth();
});
