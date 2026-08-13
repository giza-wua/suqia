// =====================================================================
// services/api.js — بديل services/firebase.js بالكامل. بدل db/auth
// object، هنا دوال fetch بسيطة بتتعامل مع الـ Worker (نفس الدومين،
// فمفيش مشاكل CORS، والجلسة عبر HttpOnly cookie تلقائياً مع كل طلب).
// =====================================================================

const BASE = "/api";

async function request(method, path, body) {
    const res = await fetch(BASE + path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "same-origin", // يبعت الـ cookie تلقائياً
    });
    let data = null;
    try { data = await res.json(); } catch { /* استجابة بدون body، عادي في بعض الحالات */ }
    if (!res.ok) {
        const err = new Error((data && data.error) || "حدث خطأ، حاول مرة أخرى.");
        err.status = res.status;
        err.friendly = true;
        throw err;
    }
    return data;
}

export const apiGet = (path) => request("GET", path);
export const apiPost = (path, body) => request("POST", path, body);
export const apiPut = (path, body) => request("PUT", path, body);
export const apiDelete = (path) => request("DELETE", path);

// ============ استيراد بالجملة — مكان واحد بس لكل شاشات الاستيراد ============
// كانت كل شاشة (المساقي، الأعضاء، النسخ الاحتياطي) عندها نسخة منفصلة
// من نفس الفكرة، وكل واحدة كانت بتبعت 10 طلبات في نفس اللحظة (متوازية)
// — ده كان بيسبب فشل غير ثابت مع المجموعات الكبيرة (الكباري 475 سجل
// مثلاً) لأن كل الطلبات المتوازية دي بتضغط على قاعدة البيانات في نفس
// اللحظة. الحل: طلب واحد بعد التاني (متتالي، مش متوازي) — أبطأ شوية،
// لكن موثوق 100% مهما كان حجم البيانات، وده أهم بكتير من السرعة لما
// الموضوع بيانات حقيقية مهمة. كل شاشات الاستيراد في التطبيق (المساقي،
// الأعضاء، النسخ الاحتياطي الشامل، النسخ الاحتياطي لكل قسم على حدة)
// بتستخدم الدالة دي بالظبط، مفيش نسخة تانية منها في أي ملف تاني.
export async function bulkImport(path, items, onProgress) {
    let done = 0, failed = 0;
    const errors = [];
    const total = items.length;
    onProgress?.(0, total);
    for (const item of items) {
        try {
            await apiPost(path, item);
        } catch (e) {
            failed++;
            const label = item?.name || item?.id || `صف رقم ${done + 1}`;
            errors.push(`${label}: ${e.message}`);
            console.warn("فشل استيراد سجل:", path, label, e.message);
        }
        done++;
        onProgress?.(done, total);
    }
    return { done, failed, total, errors };
}

// ============ بديل onSnapshot: تحديث دوري بسيط ============
// بدل استماع لحظي حقيقي (يحتاج WebSockets/Durable Objects — قرار
// مؤجَّل، راجع README-قرارات-الانتقال.md)، بنعمل polling كل 20 ثانية.
// أي صفحة عايزة "استماع مباشر" تستخدم الدالة دي بدل db.collection().onSnapshot().
//
// callback بتستقبل نفس شكل البيانات اللي onSnapshot كانت بترجّعه (array
// من الصفوف). بترجع دالة "unsubscribe" بنفس شكل Firestore، عشان صفحات
// زي admin/*.html اللي بتنادي unsubscribe() عند مغادرة الصفحة تفضل شغالة
// من غير تعديل.
export function pollCollection(path, callback, intervalMs = 20000) {
    let stopped = false;
    async function tick() {
        if (stopped) return;
        try {
            const rows = await apiGet(path);
            if (!stopped) callback(rows);
        } catch (e) {
            console.warn("polling error:", path, e.message);
        }
    }
    tick(); // أول تحميل فوري
    const id = setInterval(tick, intervalMs);
    return () => { stopped = true; clearInterval(id); };
}
