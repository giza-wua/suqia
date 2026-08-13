// =====================================================================
// data/backup.js — نسخ احتياطي واستعادة، عبر apiGet/apiPost بدل
// Firestore مباشرة. فيه شكلين:
//   1) زرار واحد شامل لكل المجموعات (زي الأول بالظبط).
//   2) زرار منفصل لكل مجموعة على حدة (تنزيل/استيراد)، مع شريط تقدّم
//      حقيقي ورسالة اكتمال واضحة (تفاصيل تحت).
//
// استثناء متعمَّد: "tickets" و"users" مش جزء من الاستعادة هنا:
//   - tickets: بيانات ميدانية متجدّدة باستمرار، استعادتها بمعرّفات
//     قديمة مش مفيدة عملياً ومحتاجة صلاحية كتابة عامة بمعرّف محدَّد
//     (خطر أمني بسيط بلا داعٍ).
//   - users: الملف الأصلي في Firestore ما كانش يحتوي كلمة المرور أصلاً
//     (كانت في Firebase Auth منفصل)، فاستعادته هنا لن تُرجع القدرة على
//     الدخول على أي حال. النسخ الاحتياطي الحقيقي لقاعدة D1 بالكامل
//     (بما فيها المستخدمين) الأصح إنه يكون عبر `wrangler d1 export`
//     مباشرة من طرف الأدمن التقني، مش من واجهة الإعدادات.
// =====================================================================

import { apiGet, apiPost, bulkImport } from '../services/api.js';
import { showAlert, showConfirm } from '../utils/modal.js';
import { showToast } from '../utils/toast.js';
import { isAdmin } from '../auth.js';
import { APP_VERSION } from '../version.js';
import { toApi as bridgeToApi } from './bridges.js';
import { toApi as wellToApi } from './wells.js';
import { toApi as drainToApi } from './drains.js';

const BACKUP_COLLECTIONS = ["masaqi", "members", "news", "canals", "bridges", "wells", "drains"];
const LAST_BACKUP_KEY = "zimam_last_backup";

export const COLLECTION_LABELS = {
    masaqi: "المساقي", canals: "الترع", bridges: "الكباري", wells: "الآبار",
    drains: "المصارف", members: "الأعضاء", news: "الأخبار",
};

// bridges/wells/drains هي المجموعات الوحيدة اللي فيها أسماء حقول
// مختلفة بين الفورم (camelCase، من التطبيق القديم "سُقيا") وقاعدة D1
// (snake_case). ملفات النسخ الاحتياطي القديمة (قبل الانتقال لـ
// Cloudflare) بتكون camelCase؛ أي نسخة احتياطية جديدة ناخدها من
// exportDatabaseBackup() هنا بتكون بالفعل snake_case لأنها جايه مباشرة
// من رد الـ API. الدالة دي بتكتشف الشكل وتحوّل بس لو محتاج.
const CAMELCASE_NORMALIZERS = {
    bridges: (item) => ("bridge_type" in item || "canal_name" in item || "build_year" in item)
        ? item : { id: item.id, ...bridgeToApi(item) },
    wells: (item) => ("water_level" in item || "design_capacity" in item || "pump_type" in item)
        ? item : { id: item.id, ...wellToApi(item) },
    drains: (item) => ("canal_name" in item)
        ? item : { id: item.id, ...drainToApi(item) },
};

// ============ شريط التقدّم العام (مشترك لكل عمليات الاستيراد/التصدير) ============
function showProgress(label) {
    const box = document.getElementById("backup-progress-box");
    const bar = document.getElementById("backup-progress-bar");
    const text = document.getElementById("backup-progress-text");
    if (!box) return;
    box.style.display = "block";
    if (bar) bar.style.width = "0%";
    if (text) text.textContent = label;
}
function updateProgress(done, total, label) {
    const bar = document.getElementById("backup-progress-bar");
    const text = document.getElementById("backup-progress-text");
    const pct = total > 0 ? Math.round((done / total) * 100) : 100;
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.textContent = `${label} — ${done} من ${total} (${pct}%)`;
}
function hideProgress(delayMs = 1200) {
    const box = document.getElementById("backup-progress-box");
    if (!box) return;
    setTimeout(() => { box.style.display = "none"; }, delayMs);
}

function recordLastOp(type) {
    try { localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify({ type, at: new Date().toISOString() })); } catch (e) { /* ignore */ }
    updateBackupLastInfo();
}

// =====================================================================
// كل المجموعات مع بعض (زرار واحد شامل)
// =====================================================================
export async function exportDatabaseBackup() {
    if (!isAdmin()) { showAlert("هذه الميزة متاحة للمدير العام فقط."); return; }
    const btn = document.getElementById("btn-backup-export");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ جاري تجهيز النسخة الاحتياطية..."; }
    showProgress("جاري تجميع كل المجموعات...");
    try {
        const backup = { app: "زِمام الرقمية", version: APP_VERSION, exported_at: new Date().toISOString(), collections: {} };
        for (let i = 0; i < BACKUP_COLLECTIONS.length; i++) {
            const col = BACKUP_COLLECTIONS[i];
            updateProgress(i, BACKUP_COLLECTIONS.length, `تجميع ${COLLECTION_LABELS[col]}...`);
            backup.collections[col] = await apiGet(`/${col}`);
        }
        for (const canal of backup.collections.canals) canal.__history = await apiGet(`/canals/${canal.id}/history`);
        updateProgress(BACKUP_COLLECTIONS.length, BACKUP_COLLECTIONS.length, "اكتمل التجميع");

        downloadJson(backup, `zimam_backup_${new Date().toISOString().slice(0, 10)}.json`);
        const total = BACKUP_COLLECTIONS.reduce((sum, c) => sum + backup.collections[c].length, 0);
        recordLastOp("تنزيل شامل");
        showToast(`✅ تم تنزيل نسخة احتياطية كاملة (${total} سجل).`);
    } catch (e) {
        console.error(e);
        showAlert("تعذر إنشاء النسخة الاحتياطية، تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "⬇️ تنزيل نسخة احتياطية كاملة"; }
        hideProgress();
    }
}

export async function restoreDatabaseBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!isAdmin()) { showAlert("هذه الميزة متاحة للمدير العام فقط."); event.target.value = ""; return; }

    try {
        const parsed = JSON.parse(await file.text());
        if (!parsed || typeof parsed !== "object" || !parsed.collections) {
            showAlert("ملف غير صالح: هذا ليس ملف نسخة احتياطية لمنصة زِمام.");
            event.target.value = "";
            return;
        }
        const counts = BACKUP_COLLECTIONS.map(c => `${COLLECTION_LABELS[c]}: ${(parsed.collections[c] || []).length}`).join("، ");
        const ok = await showConfirm(
            `سيتم إضافة/تحديث السجلات التالية من الملف: ${counts}.\n\n(ملاحظة: البلاغات والمستخدمين لا تُستعاد من هنا). هل تريد المتابعة؟`,
            "تأكيد استعادة النسخة الاحتياطية"
        );
        if (!ok) { event.target.value = ""; return; }

        const btn = document.getElementById("btn-backup-restore");
        if (btn) { btn.disabled = true; btn.textContent = "⏳ جاري الاستعادة..."; }
        showProgress("جاري بدء الاستعادة...");

        let grandTotal = 0, grandDone = 0, grandFailed = 0;
        const perCollection = BACKUP_COLLECTIONS.map(c => (parsed.collections[c] || []).length);
        grandTotal = perCollection.reduce((a, b) => a + b, 0)
            + (parsed.collections.canals || []).reduce((sum, c) => sum + (c.__history?.length || 0), 0);

        const failuresByCollection = {};
        const allErrors = [];
        for (const col of BACKUP_COLLECTIONS) {
            const normalize = CAMELCASE_NORMALIZERS[col];
            const docs = (parsed.collections[col] || []).map(({ __history, ...rest }) => normalize ? normalize(rest) : rest);
            const { done, failed, errors } = await bulkImport(`/${col}`, docs, (d) => {
                updateProgress(grandDone + d, grandTotal, `استعادة ${COLLECTION_LABELS[col]}...`);
            });
            grandDone += done; grandFailed += failed;
            if (failed > 0) { failuresByCollection[COLLECTION_LABELS[col]] = failed; allErrors.push(...errors); }
        }
        // سجل الأعمال لكل ترعة (بعد استعادة الترع نفسها أولاً). الحقل
        // "status_after" هو الاسم الأصلي من Firestore القديمة؛ الـ API
        // بتستقبل "status" فبنحوّل الاسم هنا وقت الاستعادة بس.
        for (const canal of parsed.collections.canals || []) {
            if (Array.isArray(canal.__history) && canal.__history.length) {
                const histDocs = canal.__history.map(h => ({ ...h, status: h.status ?? h.status_after }));
                const { done, failed, errors } = await bulkImport(`/canals/${canal.id}/history`, histDocs, (d) => {
                    updateProgress(grandDone + d, grandTotal, "استعادة سجل تطهير الترع...");
                });
                grandDone += done; grandFailed += failed;
                if (failed > 0) { failuresByCollection["سجل تطهير الترع"] = (failuresByCollection["سجل تطهير الترع"] || 0) + failed; allErrors.push(...errors); }
            }
        }

        updateProgress(grandTotal, grandTotal, "اكتمل");
        recordLastOp("استعادة شاملة");
        if (grandFailed === 0) {
            showToast(`✅ اكتملت الاستعادة: ${grandDone} سجل بنجاح، من غير أي فشل.`);
        } else {
            const detail = Object.entries(failuresByCollection).map(([k, v]) => `${k}: ${v}`).join("، ");
            const sample = allErrors.slice(0, 8).join("\n");
            const more = allErrors.length > 8 ? `\n... و${allErrors.length - 8} خطأ إضافي (راجع Console بالمتصفح لكل التفاصيل)` : "";
            showAlert(`اكتملت الاستعادة جزئياً: ${grandDone - grandFailed} سجل نجح، ${grandFailed} سجل فشل (${detail}).\n\nتفاصيل الأخطاء:\n${sample}${more}`);
        }
    } catch (e) {
        console.error(e);
        showAlert("تعذر قراءة الملف أو استعادة البيانات، تأكد أن الملف نسخة احتياطية صحيحة وحاول مرة أخرى.");
    } finally {
        const btn = document.getElementById("btn-backup-restore");
        if (btn) { btn.disabled = false; btn.textContent = "⬆️ استعادة نسخة احتياطية"; }
        event.target.value = "";
        hideProgress();
    }
}

// =====================================================================
// مجموعة واحدة بس (زرار منفصل لكل قسم)
// =====================================================================
function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

export async function exportSingleCollection(col) {
    if (!isAdmin()) { showAlert("هذه الميزة متاحة للمدير العام فقط."); return; }
    const label = COLLECTION_LABELS[col] || col;
    const btn = document.getElementById(`btn-export-${col}`);
    if (btn) { btn.disabled = true; }
    showProgress(`جاري تنزيل ${label}...`);
    try {
        const rows = await apiGet(`/${col}`);
        if (col === "canals") {
            for (let i = 0; i < rows.length; i++) {
                updateProgress(i, rows.length, `جاري تنزيل سجل تطهير الترع...`);
                rows[i].__history = await apiGet(`/canals/${rows[i].id}/history`);
            }
        }
        updateProgress(rows.length, rows.length, "اكتمل التنزيل");
        downloadJson({ app: "زِمام الرقمية", version: APP_VERSION, collection: col, exported_at: new Date().toISOString(), items: rows }, `zimam_${col}_${new Date().toISOString().slice(0, 10)}.json`);
        recordLastOp(`تنزيل ${label}`);
        showToast(`✅ تم تنزيل ${label} (${rows.length} سجل).`);
    } catch (e) {
        console.error(e);
        showAlert(`تعذر تنزيل ${label}، تأكد من اتصالك بالإنترنت وحاول مرة أخرى.`);
    } finally {
        if (btn) btn.disabled = false;
        hideProgress();
    }
}

// بيقبل شكلين للملف المرفوع: (أ) ملف مجموعة واحدة بيتنزّل من
// exportSingleCollection نفسها ({items:[...]})، أو (ب) نسخة احتياطية
// شاملة قديمة ({collections:{...}}) — بياخد منها المجموعة المطلوبة بس.
export async function restoreSingleCollection(col, event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!isAdmin()) { showAlert("هذه الميزة متاحة للمدير العام فقط."); event.target.value = ""; return; }
    const label = COLLECTION_LABELS[col] || col;

    try {
        const parsed = JSON.parse(await file.text());
        let items = null;
        if (Array.isArray(parsed.items)) items = parsed.items; // ملف مجموعة واحدة
        else if (parsed.collections && Array.isArray(parsed.collections[col])) items = parsed.collections[col]; // نسخة شاملة قديمة
        else if (Array.isArray(parsed)) items = parsed; // ملف خام: array مباشرة

        if (!items) {
            showAlert(`الملف ده مفيهوش بيانات ${label} بشكل يقدر التطبيق يفهمه.`);
            event.target.value = "";
            return;
        }

        const ok = await showConfirm(`سيتم إضافة/تحديث ${items.length} سجل في ${label}. هل تريد المتابعة؟`, `تأكيد استيراد ${label}`);
        if (!ok) { event.target.value = ""; return; }

        const btn = document.getElementById(`btn-import-${col}`);
        if (btn) btn.disabled = true;
        showProgress(`جاري استيراد ${label}...`);

        const normalize = CAMELCASE_NORMALIZERS[col];
        const docs = items.map(({ __history, ...rest }) => normalize ? normalize(rest) : rest);
        const { done, failed, errors } = await bulkImport(`/${col}`, docs, (d, t) => updateProgress(d, t, `استيراد ${label}...`));

        // سجل تطهير الترع، لو موجود جوّه ملف الترع
        let histDone = 0, histFailed = 0;
        if (col === "canals") {
            for (const canal of items) {
                if (Array.isArray(canal.__history) && canal.__history.length) {
                    const histDocs = canal.__history.map(h => ({ ...h, status: h.status ?? h.status_after }));
                    const r = await bulkImport(`/canals/${canal.id}/history`, histDocs);
                    histDone += r.done; histFailed += r.failed;
                    errors.push(...r.errors);
                }
            }
        }

        updateProgress(done, done, "اكتمل");
        recordLastOp(`استيراد ${label}`);
        const totalFailed = failed + histFailed;
        if (totalFailed === 0) {
            showToast(`✅ اكتمل استيراد ${label}: ${done}${histDone ? ` + ${histDone} سجل تطهير` : ""} سجل بنجاح.`);
        } else {
            const sample = errors.slice(0, 8).join("\n");
            const more = errors.length > 8 ? `\n... و${errors.length - 8} خطأ إضافي (راجع Console بالمتصفح لكل التفاصيل)` : "";
            showAlert(`اكتمل استيراد ${label} جزئياً: ${done - failed} نجح، ${totalFailed} فشل.\n\nتفاصيل الأخطاء:\n${sample}${more}`);
        }
    } catch (e) {
        console.error(e);
        showAlert(`تعذر قراءة الملف أو استيراد ${label}، تأكد أن الملف صحيح وحاول مرة أخرى.`);
    } finally {
        const btn = document.getElementById(`btn-import-${col}`);
        if (btn) btn.disabled = false;
        event.target.value = "";
        hideProgress();
    }
}

// =====================================================================
// منطقة الخطر — مسح كل سجلات مجموعة بالكامل. الحماية مزدوجة: تأكيد في
// المتصفح (showConfirm) + السيرفر نفسه بيرفض العملية لو مبعتلوش اسم
// المجموعة بالظبط في نص التأكيد اللي المستخدم كتبه (راجع دالة wipe في functions/api/[[path]].js).
// =====================================================================
export async function wipeCollection(col) {
    if (!isAdmin()) { showAlert("هذه الميزة متاحة للمدير العام فقط."); return; }
    const label = COLLECTION_LABELS[col] || col;
    const typed = document.getElementById(`wipe-confirm-${col}`)?.value?.trim();
    if (typed !== label) {
        showAlert(`لازم تكتب اسم القسم بالظبط ("${label}") في الخانة قبل ما تقدر تمسح — ده عشان محدش يمسح بياناته بالغلط.`);
        return;
    }
    const ok = await showConfirm(
        `هتمسح كل بيانات "${label}" نهائياً من غير أي رجعة. متأكد 100%؟ (لو حابب تحتفظ بنسخة، نزّل باك أب أولاً من فوق قبل ما تكمل)`,
        `⚠️ تأكيد أخير: مسح ${label}`
    );
    if (!ok) return;

    const btn = document.getElementById(`btn-wipe-${col}`);
    if (btn) { btn.disabled = true; btn.textContent = "⏳ جاري المسح..."; }
    try {
        await apiPost(`/${col}/wipe`, { confirm: col });
        showToast(`🗑️ تم مسح كل بيانات ${label}.`);
        const input = document.getElementById(`wipe-confirm-${col}`);
        if (input) input.value = "";
        recordLastOp(`مسح ${label}`);
    } catch (e) {
        showAlert(e.friendly ? e.message : `تعذر مسح بيانات ${label}، حاول مرة أخرى.`);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "🗑️ امسح نهائياً"; }
    }
}

export function updateBackupLastInfo() {
    const el = document.getElementById("backup-last-info");
    if (!el) return;
    try {
        const raw = localStorage.getItem(LAST_BACKUP_KEY);
        if (!raw) { el.textContent = "لم يتم إجراء أي نسخ احتياطي أو استعادة من هذا الجهاز بعد."; return; }
        const info = JSON.parse(raw);
        const date = new Date(info.at);
        el.textContent = `آخر عملية (${info.type}) من هذا الجهاز: ${date.toLocaleDateString("ar-EG")} - ${date.toLocaleTimeString("ar-EG")}`;
    } catch (e) { el.textContent = ""; }
}

// =====================================================================
// فحص حالة النظام (Health Check)
// =====================================================================
// بديل الاعتماد على window._loaded/window.<x>Cache (اللي بتتحدَّث بس
// وأنت فاتح صفحة المجموعة نفسها) — صفحة الإعدادات بتجيب عدد كل مجموعة
// بنفسها مباشرة، مستقلة تماماً عن أي صفحة تانية.
const HEALTH_COLLECTIONS = ["tickets", "masaqi", "canals", "members", "news", "bridges", "wells", "drains"];

function setHealthDot(key, state) {
    const dot = document.getElementById(`health-dot-${key}`);
    if (!dot) return;
    dot.classList.remove("ok", "warn", "bad");
    if (state) dot.classList.add(state);
}

export async function renderSystemHealth() {
    const online = navigator.onLine;
    setHealthDot("connection", online ? "ok" : "bad");
    const connVal = document.getElementById("health-val-connection");
    if (connVal) connVal.textContent = online ? "✅ متصل" : "❌ غير متصل";

    const fsVal = document.getElementById("health-val-firestore");
    if (fsVal && !online) { fsVal.textContent = "⏸️ وضع عدم الاتصال"; setHealthDot("firestore", "warn"); }

    for (const key of HEALTH_COLLECTIONS) {
        const valEl = document.getElementById(`health-val-${key}`);
        if (valEl) valEl.textContent = "⏳ جاري التحميل...";
    }
    const teamValEl = document.getElementById("health-val-team");
    if (teamValEl) teamValEl.textContent = "⏳ جاري التحميل...";

    const aboutOnline = document.getElementById("about-online-status");
    if (aboutOnline) aboutOnline.textContent = online ? "✅ متصل" : "❌ غير متصل";

    if (!online) { updateBackupLastInfo(); return; }

    let allOk = true;
    const results = await Promise.allSettled(HEALTH_COLLECTIONS.map(key => apiGet(`/${key}`)));
    results.forEach((r, i) => {
        const key = HEALTH_COLLECTIONS[i];
        const valEl = document.getElementById(`health-val-${key}`);
        if (r.status === "fulfilled") {
            setHealthDot(key, "ok");
            if (valEl) valEl.textContent = `${r.value.length} سجل`;
        } else {
            allOk = false;
            setHealthDot(key, "bad");
            const msg = r.reason?.message || "خطأ غير معروف";
            console.error(`فحص حالة "${key}" فشل:`, msg);
            if (valEl) { valEl.textContent = `❌ ${msg}`; valEl.title = msg; }
        }
    });

    try {
        const team = await apiGet("/users");
        setHealthDot("team", "ok");
        if (teamValEl) teamValEl.textContent = `${team.length} مستخدم`;
    } catch {
        allOk = false;
        setHealthDot("team", "bad"); // غالباً 403 لو مش admin — متوقَّع، مش عطل حقيقي
        if (teamValEl) teamValEl.textContent = "بدون صلاحية";
    }

    setHealthDot("firestore", allOk ? "ok" : "warn");
    if (fsVal) fsVal.textContent = allOk ? "✅ متصلة ومباشرة" : "⚠️ بعض المجموعات لم تُحمَّل";

    measureServerLatency();
    updateBackupLastInfo();
}

// ============ قياس زمن الاستجابة الفعلي مع الـ Worker ============
export async function measureServerLatency() {
    const valEl = document.getElementById("health-val-latency");
    const subEl = document.getElementById("health-sub-latency");
    if (!valEl) return;
    if (!navigator.onLine) {
        setHealthDot("latency", "bad");
        valEl.textContent = "❌ لا يوجد اتصال";
        if (subEl) subEl.textContent = "";
        return;
    }
    setHealthDot("latency", "warn");
    valEl.textContent = "⏳ جاري القياس...";
    try {
        const start = performance.now();
        await apiGet("/auth/me");
        const ms = Math.round(performance.now() - start);
        valEl.textContent = `${ms} مللي ثانية`;
        setHealthDot("latency", ms < 600 ? "ok" : ms < 1500 ? "warn" : "bad");
        if (subEl) subEl.textContent = ms < 600 ? "استجابة ممتازة" : ms < 1500 ? "استجابة مقبولة" : "استجابة بطيئة";
    } catch (e) {
        setHealthDot("latency", "bad");
        valEl.textContent = "❌ تعذر القياس";
        if (subEl) subEl.textContent = "";
    }
}

window.addEventListener("online", renderSystemHealth);
window.addEventListener("offline", renderSystemHealth);
