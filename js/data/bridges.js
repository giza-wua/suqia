// =====================================================================
// js/data/bridges.js — نفس الحقول وأسماء عناصر DOM بالظبط (camelCase،
// زي br-bridgeType) عشان صفحة bridges.html ميحتاجش أي تعديل. الفرق
// الوحيد: تحويل صريح بين camelCase (الفورم) و snake_case (اللي الـ
// Worker/D1 بيستخدمه) عند الإرسال والاستقبال — راجع FIELD_MAP.
// =====================================================================

import { apiPost, apiPut, apiDelete, pollCollection, bulkImport } from "../services/api.js";
import { showAlert, showConfirm } from "../utils/modal.js";
import { showToast } from "../utils/toast.js";
import { isDataEditor } from "../auth.js";
import { loadingRow, emptyRow, escapeHtml, setButtonLoading, resetButtonLoading, markInvalidFields, clearInvalidFields } from "../utils/ui-helpers.js";
import { icon } from "../icons.js";
import { openDetail, specGrid, mapsLink, notesBlock } from "../utils/detail-view.js";

const COND_BADGE = { "ممتاز": "green", "جيد": "green", "متوسط": "yellow", "يحتاج صيانة": "yellow", "حرج": "red" };
const FIELDS = ["name", "bridgeType", "location", "canalName", "span", "width", "load", "material", "buildYear", "condition", "notes", "lat", "lng"];
const FIELD_MAP = { bridgeType: "bridge_type", canalName: "canal_name", buildYear: "build_year" }; // الباقي نفس الاسم في الاتنين

export function toApi(data) {
    const out = {};
    for (const k of FIELDS) out[FIELD_MAP[k] || k] = data[k] ?? "";
    return out;
}
function fromApi(row) {
    const out = { id: row.id };
    for (const k of FIELDS) out[k] = row[FIELD_MAP[k] || k];
    return out;
}

export async function saveBridge() {
    const id = document.getElementById("br-id").value;
    const data = {};
    FIELDS.forEach(k => { const v = document.getElementById("br-" + k)?.value?.trim(); if (v) data[k] = v; });
    clearInvalidFields(["br-name"]);
    if (!data.name) {
        markInvalidFields(["br-name"]);
        showToast("⚠️ اسم الكبري مطلوب.");
        return;
    }

    setButtonLoading("btn-save-bridge", "⏳ جاري الحفظ...");
    try {
        if (id) await apiPut(`/bridges/${id}`, toApi(data));
        else await apiPost("/bridges", toApi(data));
        showToast(id ? "✅ تم تحديث بيانات الكبري." : "💾 تم حفظ الكبري.");
        cancelEditBridge();
    } catch (e) {
        console.error(e);
        showAlert(e.friendly ? e.message : "تعذر حفظ البيانات، حاول مرة أخرى.");
    } finally {
        resetButtonLoading("btn-save-bridge");
    }
}

export function editBridgeTrigger(id) {
    if (!isDataEditor()) return;
    const b = window.bridgesCache.find(x => x.id === id);
    if (!b) return;
    document.getElementById("br-id").value = b.id;
    FIELDS.forEach(k => { const el = document.getElementById("br-" + k); if (el) el.value = b[k] || ""; });
    document.getElementById("btn-save-bridge").innerHTML = `${icon("save", 16)} تحديث`;
    document.getElementById("btn-cancel-edit-bridge").style.display = "inline-block";
    document.getElementById("dialog-title").textContent = "تعديل بيانات الكبري";
    document.getElementById("form-dialog-overlay").classList.add("open");
}

export function cancelEditBridge() {
    document.getElementById("br-id").value = "";
    FIELDS.forEach(k => { const el = document.getElementById("br-" + k); if (el) el.value = ""; });
    document.getElementById("btn-save-bridge").innerHTML = `${icon("save", 16)} حفظ`;
    document.getElementById("btn-cancel-edit-bridge").style.display = "none";
    document.getElementById("form-dialog-overlay")?.classList.remove("open");
}

export async function deleteBridge(id) {
    const ok = await showConfirm("حذف هذا الكبري نهائياً؟");
    if (!ok) return;
    try {
        await apiDelete(`/bridges/${id}`);
        showToast("🗑️ تم حذف الكبري.");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر الحذف، حاول مرة أخرى.");
    }
}

// ============ استيراد Excel - الكباري ============
export async function handleExcelImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    showToast("⏳ جاري معالجة Excel...");
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array", cellDates: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            const items = [];
            for (let row of rows) {
                let r = {}; for (let k in row) r[k.toString().trim()] = row[k];
                let name = r["اسم الكبري"] || r["الكبري"];
                if (!name) continue;
                items.push(toApi({
                    name: String(name).trim(),
                    bridgeType: r["النوع"] || "",
                    location: r["الموقع"] || "",
                    canalName: r["الترعة/المصرف"] || r["الترعة"] || "",
                    span: r["الفتحة"] || "",
                    width: r["العرض"] || "",
                    load: r["الحمل"] || "",
                    material: r["مادة الإنشاء"] || "",
                    buildYear: r["سنة الإنشاء"] || "",
                    condition: r["الحالة"] || "",
                    lat: r["خط العرض"] || "", lng: r["خط الطول"] || "",
                    notes: r["ملاحظات"] || "",
                }));
            }
            showToast(`⏳ جاري استيراد ${items.length} كبري، ثانية لحظات...`);
            const { done, failed, errors } = await bulkImport("/bridges", items);
            if (failed === 0) showToast(`✅ اكتمل الاستيراد: ${done} كبري بنجاح.`);
            else showAlert(`اكتمل الاستيراد جزئياً: ${done - failed} نجح، ${failed} فشل.\n\nتفاصيل الأخطاء:\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? `\n... و${errors.length - 8} خطأ إضافي` : ""}`);
        } catch (err) { console.error(err); showAlert("حدث خطأ في قراءة ملف Excel، تأكد من تنسيق الأعمدة."); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
}

const GOOD_CONDITIONS = ["ممتاز", "جيد"];
const WARN_CONDITIONS = ["متوسط", "يحتاج صيانة"];
const BAD_CONDITIONS = ["حرج"];

let bridgeConditionFilter = "";
export function filterBridgesByCondition(group) {
    bridgeConditionFilter = group;
    renderBridges();
    document.getElementById("bridges-table")?.closest(".card-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderBridges() {
    const search = (document.getElementById("filter-bridge-search")?.value || "").toLowerCase();
    const type = document.getElementById("filter-bridge-type")?.value || "";
    const tb = document.getElementById("bridges-table-body");
    if (!tb) return;
    if (!window._loaded.bridges) { tb.innerHTML = loadingRow(6); return; }
    let data = window.bridgesCache.filter(b =>
        (!search || b.name?.toLowerCase().includes(search) || b.canalName?.toLowerCase().includes(search)) &&
        (!type || b.bridgeType === type) &&
        (!bridgeConditionFilter
            || (bridgeConditionFilter === "good" && GOOD_CONDITIONS.includes(b.condition))
            || (bridgeConditionFilter === "warn" && WARN_CONDITIONS.includes(b.condition))
            || (bridgeConditionFilter === "bad" && BAD_CONDITIONS.includes(b.condition)))
    );
    if (data.length === 0) { tb.innerHTML = emptyRow(6, "لا توجد نتائج مطابقة"); return; }
    tb.innerHTML = data.map(b => {
        const badge = b.condition ? `<span class="badge ${COND_BADGE[b.condition] || "blue"}">${escapeHtml(b.condition)}</span>` : "-";
        const actions = isDataEditor()
            ? `<button class="btn-icon" onclick="viewBridgeDetail('${b.id}')">👁️ عرض</button> <button class="btn-icon" onclick="editBridgeTrigger('${b.id}')">✏️ تعديل</button> <button class="btn-icon" style="color:var(--danger)" onclick="deleteBridge('${b.id}')">🗑️ حذف</button>`
            : `<button class="btn-icon" onclick="viewBridgeDetail('${b.id}')">👁️ عرض التفاصيل</button>`;
        return `<tr>
            <td data-label="اسم الكبري"><b style="cursor:pointer;color:var(--nile-dark)" onclick="viewBridgeDetail('${b.id}')">${escapeHtml(b.name)}</b></td>
            <td data-label="النوع">${escapeHtml(b.bridgeType) || "-"}</td>
            <td data-label="الترعة/المصرف">${escapeHtml(b.canalName) || "-"}</td>
            <td data-label="الموقع">${escapeHtml(b.location) || "-"}</td>
            <td data-label="الحالة">${badge}</td>
            <td data-label="إجراءات">${actions}</td>
        </tr>`;
    }).join("");
}

let stopPolling = null;

// ============ كرت عرض التفاصيل الكامل ============
export function viewBridgeDetail(id) {
    const b = window.bridgesCache.find(x => x.id === id);
    if (!b) return;
    const badge = b.condition ? `<span class="badge ${COND_BADGE[b.condition] || "blue"}">${escapeHtml(b.condition)}</span>` : "—";
    const body = specGrid([
        { label: "النوع", value: b.bridgeType },
        { label: "الترعة / المصرف", value: b.canalName },
        { label: "الموقع", value: b.location },
        { label: "الفتحة (م)", value: b.span },
        { label: "العرض (م)", value: b.width },
        { label: "الحمل (طن)", value: b.load },
        { label: "مادة الإنشاء", value: b.material },
        { label: "سنة الإنشاء", value: b.buildYear },
        { label: "الحالة", html: badge },
    ]) + notesBlock(b.notes) + mapsLink(b.lat, b.lng);
    openDetail(`${icon("bridge", 18)} ${escapeHtml(b.name)}`, body);
}

function updateBridgesSummary() {
    const good = document.getElementById("bridges-summary-good");
    const warn = document.getElementById("bridges-summary-warn");
    const bad = document.getElementById("bridges-summary-bad");
    const total = document.getElementById("bridges-summary-total");
    if (good) good.textContent = window.bridgesCache.filter(b => GOOD_CONDITIONS.includes(b.condition)).length;
    if (warn) warn.textContent = window.bridgesCache.filter(b => WARN_CONDITIONS.includes(b.condition)).length;
    if (bad) bad.textContent = window.bridgesCache.filter(b => BAD_CONDITIONS.includes(b.condition)).length;
    if (total) total.textContent = window.bridgesCache.length;
}

export function initBridgesListener() {
    if (stopPolling) return;
    stopPolling = pollCollection("/bridges", (rows) => {
        window.bridgesCache = rows.map(fromApi).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        window._loaded.bridges = true;
        renderBridges();
        updateBridgesSummary();
    });
}
