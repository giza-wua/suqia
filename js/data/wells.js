// =====================================================================
// js/data/wells.js — نفس نمط bridges.js بالظبط (camelCase في الفورم،
// تحويل لـ snake_case عند الإرسال/الاستقبال).
// =====================================================================

import { apiPost, apiPut, apiDelete, pollCollection, bulkImport } from "../services/api.js";
import { showAlert, showConfirm } from "../utils/modal.js";
import { showToast } from "../utils/toast.js";
import { isDataEditor } from "../auth.js";
import { loadingRow, emptyRow, escapeHtml, setButtonLoading, resetButtonLoading, markInvalidFields, clearInvalidFields } from "../utils/ui-helpers.js";
import { icon } from "../icons.js";
import { openDetail, specGrid, mapsLink, notesBlock } from "../utils/detail-view.js";

const COND_BADGE = { "يعمل بكفاءة": "green", "يعمل جزئياً": "yellow", "متوقف مؤقت": "yellow", "خارج الخدمة": "red", "قيد الإنشاء": "blue" };
const FIELDS = ["name", "district", "location", "purpose", "depth", "diameter", "waterLevel", "designCapacity", "actualCapacity", "pumpType", "pumpPower", "drillYear", "condition", "notes", "lat", "lng"];
const FIELD_MAP = { waterLevel: "water_level", designCapacity: "design_capacity", actualCapacity: "actual_capacity", pumpType: "pump_type", pumpPower: "pump_power", drillYear: "drill_year" };

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

export async function saveWell() {
    const id = document.getElementById("wl-id").value;
    const data = {};
    FIELDS.forEach(k => { const v = document.getElementById("wl-" + k)?.value?.trim(); if (v) data[k] = v; });
    clearInvalidFields(["wl-name"]);
    if (!data.name) {
        markInvalidFields(["wl-name"]);
        showToast("⚠️ اسم البئر مطلوب.");
        return;
    }

    setButtonLoading("btn-save-well", "⏳ جاري الحفظ...");
    try {
        if (id) await apiPut(`/wells/${id}`, toApi(data));
        else await apiPost("/wells", toApi(data));
        showToast(id ? "✅ تم تحديث بيانات البئر." : "💾 تم حفظ البئر.");
        cancelEditWell();
    } catch (e) {
        console.error(e);
        showAlert(e.friendly ? e.message : "تعذر حفظ البيانات، حاول مرة أخرى.");
    } finally {
        resetButtonLoading("btn-save-well");
    }
}

export function editWellTrigger(id) {
    if (!isDataEditor()) return;
    const w = window.wellsCache.find(x => x.id === id);
    if (!w) return;
    document.getElementById("wl-id").value = w.id;
    FIELDS.forEach(k => { const el = document.getElementById("wl-" + k); if (el) el.value = w[k] || ""; });
    document.getElementById("btn-save-well").innerHTML = `${icon("save", 16)} تحديث`;
    document.getElementById("btn-cancel-edit-well").style.display = "inline-block";
    document.getElementById("dialog-title").textContent = "تعديل بيانات البئر";
    document.getElementById("form-dialog-overlay").classList.add("open");
}

export function cancelEditWell() {
    document.getElementById("wl-id").value = "";
    FIELDS.forEach(k => { const el = document.getElementById("wl-" + k); if (el) el.value = ""; });
    document.getElementById("btn-save-well").innerHTML = `${icon("save", 16)} حفظ`;
    document.getElementById("btn-cancel-edit-well").style.display = "none";
    document.getElementById("form-dialog-overlay")?.classList.remove("open");
}

export async function deleteWell(id) {
    const ok = await showConfirm("حذف هذا البئر نهائياً؟");
    if (!ok) return;
    try {
        await apiDelete(`/wells/${id}`);
        showToast("🗑️ تم حذف البئر.");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر الحذف، حاول مرة أخرى.");
    }
}

// ============ استيراد Excel - الآبار ============
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
                let name = r["اسم البئر"] || r["البئر"];
                if (!name) continue;
                items.push(toApi({
                    name: String(name).trim(),
                    district: r["المركز"] || "",
                    location: r["الموقع"] || "",
                    purpose: r["الغرض"] || r["النوع / الغرض"] || "",
                    depth: r["العمق"] || "",
                    diameter: r["القطر"] || "",
                    waterLevel: r["المنسوب الحرج"] || "",
                    designCapacity: r["الطاقة التصميمية"] || "",
                    actualCapacity: r["الطاقة الفعلية"] || "",
                    pumpType: r["نوع الطلمبة"] || "",
                    pumpPower: r["قدرة الطلمبة"] || "",
                    drillYear: r["سنة الحفر"] || "",
                    condition: r["الحالة"] || "",
                    lat: r["خط العرض"] || "", lng: r["خط الطول"] || "",
                    notes: r["ملاحظات"] || "",
                }));
            }
            showToast(`⏳ جاري استيراد ${items.length} بئر، ثانية لحظات...`);
            const { done, failed, errors } = await bulkImport("/wells", items);
            if (failed === 0) showToast(`✅ اكتمل الاستيراد: ${done} بئر بنجاح.`);
            else showAlert(`اكتمل الاستيراد جزئياً: ${done - failed} نجح، ${failed} فشل.\n\nتفاصيل الأخطاء:\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? `\n... و${errors.length - 8} خطأ إضافي` : ""}`);
        } catch (err) { console.error(err); showAlert("حدث خطأ في قراءة ملف Excel، تأكد من تنسيق الأعمدة."); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
}

const GOOD_CONDITIONS = ["يعمل بكفاءة"];
const WARN_CONDITIONS = ["يعمل جزئياً", "متوقف مؤقت", "قيد الإنشاء"];
const BAD_CONDITIONS = ["خارج الخدمة"];

let wellConditionFilter = "";
export function filterWellsByCondition(group) {
    wellConditionFilter = group;
    renderWells();
    document.getElementById("wells-table")?.closest(".card-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderWells() {
    const search = (document.getElementById("filter-well-search")?.value || "").toLowerCase();
    const district = document.getElementById("filter-well-district")?.value || "";
    const tb = document.getElementById("wells-table-body");
    if (!tb) return;
    if (!window._loaded.wells) { tb.innerHTML = loadingRow(6); return; }
    let data = window.wellsCache.filter(w =>
        (!search || w.name?.toLowerCase().includes(search)) &&
        (!district || w.district === district) &&
        (!wellConditionFilter
            || (wellConditionFilter === "good" && GOOD_CONDITIONS.includes(w.condition))
            || (wellConditionFilter === "warn" && WARN_CONDITIONS.includes(w.condition))
            || (wellConditionFilter === "bad" && BAD_CONDITIONS.includes(w.condition)))
    );
    if (data.length === 0) { tb.innerHTML = emptyRow(6, "لا توجد نتائج مطابقة"); return; }
    tb.innerHTML = data.map(w => {
        const badge = w.condition ? `<span class="badge ${COND_BADGE[w.condition] || "blue"}">${escapeHtml(w.condition)}</span>` : "-";
        const actions = isDataEditor()
            ? `<button class="btn-icon" onclick="viewWellDetail('${w.id}')">👁️ عرض</button> <button class="btn-icon" onclick="editWellTrigger('${w.id}')">✏️ تعديل</button> <button class="btn-icon" style="color:var(--danger)" onclick="deleteWell('${w.id}')">🗑️ حذف</button>`
            : `<button class="btn-icon" onclick="viewWellDetail('${w.id}')">👁️ عرض التفاصيل</button>`;
        return `<tr>
            <td data-label="اسم البئر"><b style="cursor:pointer;color:var(--nile-dark)" onclick="viewWellDetail('${w.id}')">${escapeHtml(w.name)}</b></td>
            <td data-label="المركز">${escapeHtml(w.district) || "-"}</td>
            <td data-label="الغرض">${escapeHtml(w.purpose) || "-"}</td>
            <td data-label="العمق (م)">${escapeHtml(w.depth) || "-"}</td>
            <td data-label="الحالة">${badge}</td>
            <td data-label="إجراءات">${actions}</td>
        </tr>`;
    }).join("");
}

let stopPolling = null;

// ============ كرت عرض التفاصيل الكامل ============
export function viewWellDetail(id) {
    const w = window.wellsCache.find(x => x.id === id);
    if (!w) return;
    const badge = w.condition ? `<span class="badge ${COND_BADGE[w.condition] || "blue"}">${escapeHtml(w.condition)}</span>` : "—";
    const body = specGrid([
        { label: "المركز", value: w.district },
        { label: "الموقع", value: w.location },
        { label: "النوع / الغرض", value: w.purpose },
        { label: "العمق (م)", value: w.depth },
        { label: "القطر (بوصة)", value: w.diameter },
        { label: "المنسوب الحرج (م)", value: w.waterLevel },
        { label: "الطاقة التصميمية (م³/يوم)", value: w.designCapacity },
        { label: "الطاقة الفعلية (م³/يوم)", value: w.actualCapacity },
        { label: "نوع الطلمبة", value: w.pumpType },
        { label: "قدرة الطلمبة (حصان)", value: w.pumpPower },
        { label: "سنة الحفر", value: w.drillYear },
        { label: "الحالة", html: badge },
    ]) + notesBlock(w.notes) + mapsLink(w.lat, w.lng);
    openDetail(`${icon("well", 18)} ${escapeHtml(w.name)}`, body);
}

function updateWellsSummary() {
    const good = document.getElementById("wells-summary-good");
    const warn = document.getElementById("wells-summary-warn");
    const bad = document.getElementById("wells-summary-bad");
    const total = document.getElementById("wells-summary-total");
    if (good) good.textContent = window.wellsCache.filter(w => GOOD_CONDITIONS.includes(w.condition)).length;
    if (warn) warn.textContent = window.wellsCache.filter(w => WARN_CONDITIONS.includes(w.condition)).length;
    if (bad) bad.textContent = window.wellsCache.filter(w => BAD_CONDITIONS.includes(w.condition)).length;
    if (total) total.textContent = window.wellsCache.length;
}

export function initWellsListener() {
    if (stopPolling) return;
    stopPolling = pollCollection("/wells", (rows) => {
        window.wellsCache = rows.map(fromApi).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        window._loaded.wells = true;
        renderWells();
        updateWellsSummary();
    });
}
