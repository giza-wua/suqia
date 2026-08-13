// =====================================================================
// js/data/drains.js — نفس النمط. canalName -> canal_name هو التحويل
// الوحيد المطلوب هنا (باقي الحقول نفس الاسم في الاتنين).
// =====================================================================

import { apiPost, apiPut, apiDelete, pollCollection, bulkImport } from "../services/api.js";
import { showAlert, showConfirm } from "../utils/modal.js";
import { showToast } from "../utils/toast.js";
import { isDataEditor } from "../auth.js";
import { loadingRow, emptyRow, escapeHtml, setButtonLoading, resetButtonLoading, markInvalidFields, clearInvalidFields, normalizeText, syncDirectorateFilterOptions } from "../utils/ui-helpers.js";
import { icon } from "../icons.js";
import { openDetail, specGrid, mapsLink, notesBlock } from "../utils/detail-view.js";

const FIELDS = ["name", "eng", "bank", "canalName", "length", "zomam", "lat", "lng", "notes"];
const FIELD_MAP = { canalName: "canal_name" };

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

export async function saveDrain() {
    const id = document.getElementById("dr-id").value;
    const data = {};
    FIELDS.forEach(k => { const v = document.getElementById("dr-" + k)?.value?.trim(); if (v) data[k] = v; });
    clearInvalidFields(["dr-name", "dr-eng"]);
    if (!data.name || !data.eng) {
        markInvalidFields([!data.eng ? "dr-eng" : null, !data.name ? "dr-name" : null].filter(Boolean));
        showToast("⚠️ الرجاء إدخال اسم المصرف واختيار الهندسة.");
        return;
    }

    setButtonLoading("btn-save-drain", "⏳ جاري الحفظ...");
    try {
        if (id) await apiPut(`/drains/${id}`, toApi(data));
        else await apiPost("/drains", toApi(data));
        showToast(id ? "✅ تم تحديث بيانات المصرف." : "💾 تم حفظ المصرف.");
        cancelEditDrain();
    } catch (e) {
        console.error(e);
        showAlert(e.friendly ? e.message : "تعذر حفظ البيانات، حاول مرة أخرى.");
    } finally {
        resetButtonLoading("btn-save-drain");
    }
}

export function editDrainTrigger(id) {
    if (!isDataEditor()) return;
    const d = window.drainsCache.find(x => x.id === id);
    if (!d) return;
    document.getElementById("dr-id").value = d.id;
    FIELDS.forEach(k => { const el = document.getElementById("dr-" + k); if (el) el.value = d[k] || ""; });
    document.getElementById("btn-save-drain").innerHTML = `${icon("save", 16)} تحديث`;
    document.getElementById("btn-cancel-edit-drain").style.display = "inline-block";
    document.getElementById("dialog-title").textContent = "تعديل بيانات المصرف";
    document.getElementById("form-dialog-overlay").classList.add("open");
}

export function cancelEditDrain() {
    document.getElementById("dr-id").value = "";
    FIELDS.forEach(k => { const el = document.getElementById("dr-" + k); if (el) el.value = ""; });
    document.getElementById("btn-save-drain").innerHTML = `${icon("save", 16)} حفظ`;
    document.getElementById("btn-cancel-edit-drain").style.display = "none";
    document.getElementById("form-dialog-overlay")?.classList.remove("open");
}

export async function deleteDrain(id) {
    const ok = await showConfirm("حذف هذا المصرف نهائياً؟");
    if (!ok) return;
    try {
        await apiDelete(`/drains/${id}`);
        showToast("🗑️ تم حذف المصرف.");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر الحذف، حاول مرة أخرى.");
    }
}

// ============ استيراد Excel - المصارف ============
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
                let name = r["اسم المصرف"] || r["المصرف"];
                if (!name) continue;
                items.push(toApi({
                    name: String(name).trim(),
                    eng: r["الهندسة"] || "",
                    bank: r["البر"] || "",
                    canalName: r["المصرف المغذي"] || r["المصب"] || "",
                    length: r["الطول"] || "",
                    zomam: r["الزمام"] || "",
                    lat: r["خط العرض"] || "", lng: r["خط الطول"] || "",
                    notes: r["ملاحظات"] || "",
                }));
            }
            showToast(`⏳ جاري استيراد ${items.length} مصرف، ثانية لحظات...`);
            const { done, failed, errors } = await bulkImport("/drains", items);
            if (failed === 0) showToast(`✅ اكتمل الاستيراد: ${done} مصرف بنجاح.`);
            else showAlert(`اكتمل الاستيراد جزئياً: ${done - failed} نجح، ${failed} فشل.\n\nتفاصيل الأخطاء:\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? `\n... و${errors.length - 8} خطأ إضافي` : ""}`);
        } catch (err) { console.error(err); showAlert("حدث خطأ في قراءة ملف Excel، تأكد من تنسيق الأعمدة."); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
}

export function renderDrains() {
    const search = (document.getElementById("filter-drain-search")?.value || "").toLowerCase();
    const eng = document.getElementById("filter-drain-directorate")?.value || "";
    const tb = document.getElementById("drains-table-body");
    if (!tb) return;
    if (!window._loaded.drains) { tb.innerHTML = loadingRow(6); return; }
    let data = window.drainsCache.filter(d =>
        (!search || d.name?.toLowerCase().includes(search)) &&
        (!eng || normalizeText(d.eng) === normalizeText(eng))
    );
    if (data.length === 0) { tb.innerHTML = emptyRow(6, "لا توجد نتائج مطابقة"); return; }
    tb.innerHTML = data.map(d => {
        const actions = isDataEditor()
            ? `<button class="btn-icon" onclick="viewDrainDetail('${d.id}')">👁️ عرض</button> <button class="btn-icon" onclick="editDrainTrigger('${d.id}')">✏️ تعديل</button> <button class="btn-icon" style="color:var(--danger)" onclick="deleteDrain('${d.id}')">🗑️ حذف</button>`
            : `<button class="btn-icon" onclick="viewDrainDetail('${d.id}')">👁️ عرض التفاصيل</button>`;
        return `<tr>
            <td data-label="اسم المصرف"><b style="cursor:pointer;color:var(--nile-dark)" onclick="viewDrainDetail('${d.id}')">${escapeHtml(d.name)}</b></td>
            <td data-label="الهندسة">${escapeHtml(d.eng)}</td>
            <td data-label="البر">${escapeHtml(d.bank) || "-"}</td>
            <td data-label="الطول (كم)">${escapeHtml(d.length) || "-"}</td>
            <td data-label="الزمام">${escapeHtml(d.zomam) || "-"}</td>
            <td data-label="إجراءات">${actions}</td>
        </tr>`;
    }).join("");
}

let stopPolling = null;

// ============ كرت عرض التفاصيل الكامل ============
export function viewDrainDetail(id) {
    const d = window.drainsCache.find(x => x.id === id);
    if (!d) return;
    const body = specGrid([
        { label: "الهندسة", value: d.eng },
        { label: "البر", value: d.bank },
        { label: "المصرف المغذي / المصب", value: d.canalName },
        { label: "الطول الكلي (كم)", value: d.length },
        { label: "الزمام المخدوم (فدان)", value: d.zomam },
    ]) + notesBlock(d.notes) + mapsLink(d.lat, d.lng);
    openDetail(`${icon("waves", 18)} ${escapeHtml(d.name)}`, body);
}

function updateDrainsSummary() {
    const total = document.getElementById("drains-summary-total");
    const totalLength = document.getElementById("drains-summary-length");
    const engCount = document.getElementById("drains-summary-eng");
    if (total) total.textContent = window.drainsCache.length;
    if (totalLength) {
        const sum = window.drainsCache.reduce((s, d) => s + (parseFloat(d.length) || 0), 0);
        totalLength.textContent = sum ? sum.toLocaleString("ar-EG") : "0";
    }
    if (engCount) engCount.textContent = new Set(window.drainsCache.map(d => d.eng).filter(Boolean)).size;
}

export function initDrainsListener() {
    if (stopPolling) return;
    stopPolling = pollCollection("/drains", (rows) => {
        window.drainsCache = rows.map(fromApi).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        window._loaded.drains = true;
        syncDirectorateFilterOptions("filter-drain-directorate", window.drainsCache, "eng");
        renderDrains();
        updateDrainsSummary();
    });
}
