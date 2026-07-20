// =====================================================================
// utils/toast.js
// رسائل التنبيه السريعة (Toast) التي تظهر وتختفي تلقائيًا.
// =====================================================================

export function showToast(msg) {
    const t = document.getElementById("system-toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove("show"), 4000);
}
