// =====================================================================
// data/masaqi.js — نفس المنطق والواجهات والأسماء المُصدَّرة بالظبط.
// التغيير الوحيد: طبقة الوصول للبيانات (apiGet/apiPost/apiPut/apiDelete
// بدل db.collection...، و pollCollection بدل onSnapshot).
// =====================================================================

import { apiPost, apiPut, apiDelete, pollCollection, bulkImport } from '../services/api.js';
import { showAlert, showConfirm } from '../utils/modal.js';
import { showToast } from '../utils/toast.js';
import { isDataEditor } from '../auth.js';
import { updateWatercourseDropdown, loadingRow, emptyRow, setButtonLoading, resetButtonLoading, markInvalidFields, clearInvalidFields, escapeHtml } from '../utils/ui-helpers.js';
import { isDateInCurrentWeek, getCurrentWeekLabel } from '../utils/week-filter.js';
import { icon } from '../icons.js';
import { openDetail, specGrid, notesBlock } from '../utils/detail-view.js';

// ============ المساقي ============
export async function saveMasqa() {
    const id = document.getElementById("ms-id").value;
    let watercourse;
    const waterSelect = document.getElementById("ms-name");
    const otherInput = document.getElementById("ms-name-other");
    if (otherInput && otherInput.style.display !== "none" && otherInput.value.trim()) {
        watercourse = otherInput.value.trim();
    } else {
        watercourse = waterSelect.value;
    }
    clearInvalidFields(["ms-directorate", "ms-name"]);
    if (watercourse === "__OTHER__" || !watercourse) { markInvalidFields(["ms-name"]); showToast("⚠️ الرجاء إدخال اسم المسقى."); return; }
    const data = {
        name: watercourse,
        directorate: document.getElementById("ms-directorate").value,
        village: document.getElementById("ms-village").value.trim() || "غير محدد",
        canal: document.getElementById("ms-canal").value.trim() || "غير محدد",
        status: document.getElementById("ms-status").value,
        gps: document.getElementById("ms-gps").value,
        date: document.getElementById("ms-date").value.trim() || "غير محدد",
        zamam: document.getElementById("ms-zamam").value.trim() || "0",
        length: document.getElementById("ms-length").value.trim() || "0",
    };
    if (!data.name || !data.directorate) {
        markInvalidFields([!data.directorate ? "ms-directorate" : null, !data.name ? "ms-name" : null].filter(Boolean));
        showToast("⚠️ الرجاء إدخال اسم المسقى والهندسة.");
        return;
    }

    const dup = window.masaqiCache.find(m => m.id !== id && m.name.trim() === data.name.trim() && m.directorate === data.directorate);
    if (dup) {
        const ok = await showConfirm(`يوجد بالفعل مسقى بنفس الاسم "${dup.name}" في ${dup.directorate}. هل أنت متأكد إن هذا سجل مختلف وتريد المتابعة؟`, "تنبيه من تكرار محتمل");
        if (!ok) return;
    }

    setButtonLoading("btn-save-masqa", "⏳ جاري الحفظ...");
    try {
        if (id) await apiPut(`/masaqi/${id}`, data);
        else await apiPost('/masaqi', data);
        showToast(id ? "✅ تم التحديث." : "✅ تم الحفظ.");
        cancelEditMasqa(!id);
        if (!id) document.getElementById("ms-directorate")?.focus();
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر حفظ البيانات، حاول مرة أخرى.");
    } finally {
        resetButtonLoading("btn-save-masqa");
    }
}

export function editMasqaTrigger(id) {
    if (!isDataEditor()) return;
    const m = window.masaqiCache.find(x => x.id === id);
    if (!m) return;
    document.getElementById("ms-id").value = m.id;
    document.getElementById("ms-directorate").value = m.directorate;
    updateWatercourseDropdown("ms");
    setTimeout(() => {
        const waterSelect = document.getElementById("ms-name");
        const otherInput = document.getElementById("ms-name-other");
        let found = false;
        if (waterSelect) {
            for (let opt of waterSelect.options) if (opt.value === m.name) { found = true; break; }
            if (found) {
                waterSelect.value = m.name; waterSelect.style.display = "";
                if (otherInput) { otherInput.style.display = "none"; otherInput.value = ""; }
            } else if (otherInput) {
                waterSelect.value = "__OTHER__"; waterSelect.style.display = "none";
                otherInput.style.display = ""; otherInput.value = m.name;
            }
        }
    }, 150);
    document.getElementById("ms-village").value = m.village;
    document.getElementById("ms-canal").value = m.canal;
    document.getElementById("ms-status").value = m.status;
    document.getElementById("ms-gps").value = m.gps || "";
    document.getElementById("ms-date").value = m.date !== "غير محدد" ? m.date : "";
    document.getElementById("ms-zamam").value = m.zamam;
    document.getElementById("ms-length").value = m.length;
    document.getElementById("btn-save-masqa").innerHTML = `${icon("save", 16)} تحديث`;
    document.getElementById("btn-cancel-edit").style.display = "inline-block";
    document.getElementById("dialog-title").textContent = "تعديل بيانات المسقى";
    document.getElementById("form-dialog-overlay").classList.add("open");
}

export function cancelEditMasqa(keepOpen) {
    document.getElementById("ms-id").value = "";
    ["ms-village", "ms-canal", "ms-gps", "ms-date", "ms-zamam", "ms-length"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("btn-save-masqa").innerHTML = `${icon("save", 16)} حفظ`;
    document.getElementById("btn-cancel-edit").style.display = "none";
    const waterSelect = document.getElementById("ms-name");
    const otherInput = document.getElementById("ms-name-other");
    if (waterSelect) waterSelect.style.display = "";
    if (otherInput) { otherInput.style.display = "none"; otherInput.value = ""; }
    updateWatercourseDropdown("ms");
    if (!keepOpen) document.getElementById("form-dialog-overlay")?.classList.remove("open");
}

export async function deleteMasqa(id) {
    const ok = await showConfirm("حذف هذا المسقى؟ لا يمكن التراجع عن هذا الإجراء.");
    if (!ok) return;
    try {
        await apiDelete(`/masaqi/${id}`);
        showToast("🗑️ تم الحذف.");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر الحذف، حاول مرة أخرى.");
    }
}

// ============ استيراد Excel - المساقي ============
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
                let name = r["المسقى"] || r["المسقي"] || r["اسم المسقى"] || r["المجرى المائي"];
                if (!name) continue;
                let st = r["الحالة"] || r["حالة التطهير"] || "تحتاج للتطهير";
                let status = st.includes("تم") ? "تم التطهير" : st.includes("جاري") ? "قيد العمل" : "تحتاج للتطهير";
                let date = r["تاريخ التطهير"] ? (r["تاريخ التطهير"] instanceof Date ? r["تاريخ التطهير"].toISOString().slice(0, 10) : String(r["تاريخ التطهير"])) : "غير محدد";
                items.push({
                    name: String(name).trim(), directorate: r["الهندسة"] || "غير محدد", village: r["القرية"] || "",
                    canal: r["الترعة"] || "", zamam: r["الزمام"] || "0", length: r["الطول"] || "0",
                    status, date, gps: r["الموقع"] || r["GPS"] || "",
                });
            }
            showToast(`⏳ جاري استيراد ${items.length} مسقى، ثانية لحظات...`);
            const { done, failed, errors } = await bulkImport('/masaqi', items);
            if (failed === 0) showToast(`✅ اكتمل الاستيراد: ${done} مسقى بنجاح.`);
            else showAlert(`اكتمل الاستيراد جزئياً: ${done - failed} نجح، ${failed} فشل.\n\nتفاصيل الأخطاء:\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? `\n... و${errors.length - 8} خطأ إضافي` : ""}`);
        } catch (err) { console.error(err); showAlert("حدث خطأ في قراءة ملف Excel، تأكد من تنسيق الأعمدة."); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
}

export function filterMasaqiByStatus(status) {
    const select = document.getElementById("filter-masqa-status");
    if (select) select.value = status;
    renderMasaqi();
    document.getElementById("masaqi-table-body")?.closest(".card-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============ عرض جدول المساقي ============
export function renderMasaqi() {
    const search = (document.getElementById("filter-masqa-search")?.value || "").toLowerCase();
    const dir = document.getElementById("filter-masqa-directorate")?.value || "";
    const st = document.getElementById("filter-masqa-status")?.value || "";
    const tb = document.getElementById("masaqi-table-body");
    if (!tb) return;
    if (!window._loaded.masaqi) { tb.innerHTML = loadingRow(9); return; }
    let data = window.masaqiCache.filter(m => (!search || m.name?.toLowerCase().includes(search)) && (!dir || m.directorate === dir) && (!st || m.status === st));
    if (data.length === 0) { tb.innerHTML = emptyRow(9, "لا توجد نتائج مطابقة"); return; }
    tb.innerHTML = data.map(m => {
        let badge = m.status === "تحتاج للتطهير" ? '<span class="badge red">تحتاج للتطهير</span>' : m.status === "تم التطهير" ? '<span class="badge green">تم التطهير</span>' : '<span class="badge yellow">قيد العمل</span>';
        let gpsHtml = m.gps ? `<span class="gps-badge"><a href="https://www.google.com/maps?q=${encodeURIComponent(m.gps)}" target="_blank" class="gps-link">📍 عرض</a></span>` : "-";
        const actions = isDataEditor()
            ? `<button class="btn-icon" onclick="viewMasqaDetail('${m.id}')">👁️ عرض</button> <button class="btn-icon" onclick="editMasqaTrigger('${m.id}')">✏️ تعديل</button> <button class="btn-icon" style="color:var(--danger)" onclick="deleteMasqa('${m.id}')">🗑️ حذف</button>`
            : `<button class="btn-icon" onclick="viewMasqaDetail('${m.id}')">👁️ عرض التفاصيل</button>`;
        return `<tr class="${m.status === "تحتاج للتطهير" ? "critical-alert" : ""}">
            <td data-label="المسقى"><b style="cursor:pointer;color:var(--nile-dark)" onclick="viewMasqaDetail('${m.id}')">${escapeHtml(m.name)}</b></td>
            <td data-label="الهندسة">${escapeHtml(m.directorate)}</td>
            <td data-label="القرية">${escapeHtml(m.village) || "-"}</td>
            <td data-label="الزمام">${escapeHtml(m.zamam)}</td>
            <td data-label="الطول">${escapeHtml(m.length)}</td>
            <td data-label="الحالة">${badge}</td>
            <td data-label="الموقع">${gpsHtml}</td>
            <td data-label="تاريخ التطهير">${escapeHtml(m.date)}</td>
            <td data-label="إجراءات">${actions}</td>
        </tr>`;
    }).join("");
}

// ============ كرت عرض التفاصيل الكامل ============
export function viewMasqaDetail(id) {
    const m = window.masaqiCache.find(x => x.id === id);
    if (!m) return;
    const badge = m.status === "تحتاج للتطهير" ? '<span class="badge red">تحتاج للتطهير</span>' : m.status === "تم التطهير" ? '<span class="badge green">تم التطهير</span>' : m.status ? '<span class="badge yellow">قيد العمل</span>' : '<span class="badge blue">غير محدد</span>';
    const gps = (m.gps || "").split(",").map(s => s.trim());
    const mapsHtml = gps.length === 2 && gps.every(v => !Number.isNaN(parseFloat(v)))
        ? `<div style="margin-top:16px;text-align:center;padding-top:14px;border-top:1px solid var(--border-light)"><a href="https://www.google.com/maps?q=${encodeURIComponent(m.gps)}" target="_blank" rel="noopener" style="color:var(--info);font-weight:800;text-decoration:none;font-size:0.85rem;">📍 فتح الموقع في خرائط جوجل ↗</a></div>`
        : "";
    const body = specGrid([
        { label: "الهندسة", value: m.directorate },
        { label: "القرية", value: m.village },
        { label: "الترعة التابع لها", value: m.canal },
        { label: "الزمام (فدان)", value: m.zamam },
        { label: "الطول (متر)", value: m.length },
        { label: "تاريخ آخر تطهير", value: m.date },
        { label: "حالة التطهير", html: badge },
    ]) + notesBlock(m.notes) + mapsHtml;
    openDetail(`${icon("droplet", 18)} ${escapeHtml(m.name)}`, body);
}

const MASAQI_BADGE = { "تحتاج للتطهير": "red", "قيد العمل": "yellow", "تم التطهير": "green" };
const MASAQI_ACCENT = { "تحتاج للتطهير": "accent-urgent", "قيد العمل": "accent-progress", "تم التطهير": "accent-awareness" };

function isMasqaRelevantThisWeek(m) {
    if (m.status === "قيد العمل") return true;
    if (m.status === "تم التطهير") return isDateInCurrentWeek(m.date);
    return false;
}

export function renderPublicMasaqiBoard() {
    const grid = document.getElementById("masaqi-board-grid");
    const summaryEl = document.getElementById("masaqi-board-date");
    const todayEl = document.getElementById("masaqi-board-today");
    if (!grid) return;
    if (todayEl) todayEl.textContent = `أعمال هذا الأسبوع (${getCurrentWeekLabel()})`;
    if (!window._loaded.masaqi) {
        grid.innerHTML = '<div class="news-card-empty">⏳ جاري تحميل بيانات المساقي...</div>';
        if (summaryEl) summaryEl.textContent = "⏳ جاري تحميل بيانات المساقي...";
        return;
    }
    const dir = document.getElementById("masaqi-board-directorate-filter")?.value || "";
    const all = window.masaqiCache.filter(isMasqaRelevantThisWeek);
    if (summaryEl) {
        summaryEl.textContent = all.length > 0 ? `🔧 ${all.length} مسقى جاري أو تم تطهيرها هذا الأسبوع` : "لا توجد أعمال تطهير مسجّلة هذا الأسبوع";
    }
    const data = all.filter(m => !dir || m.directorate === dir);
    if (data.length === 0) {
        grid.innerHTML = `<div class="news-card-empty">${all.length === 0 ? "لا توجد أعمال تطهير مسجّلة هذا الأسبوع" : "لا توجد نتائج لهذه الهندسة"}</div>`;
        return;
    }
    const order = { "قيد العمل": 0, "تم التطهير": 1 };
    const sorted = [...data].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    grid.innerHTML = sorted.map(m => {
        const accent = MASAQI_ACCENT[m.status] || "accent-general";
        const badgeColor = MASAQI_BADGE[m.status] || "blue";
        const dateLine = m.date && m.date !== "غير محدد" ? `تاريخ التطهير: ${escapeHtml(m.date)}` : "";
        return `<div class="news-card ${accent}">
            <span class="news-card-badge ${badgeColor}">${escapeHtml(m.status) || "غير محدد"}</span>
            <h4>${escapeHtml(m.name)}</h4>
            <p>${escapeHtml(m.directorate)}${m.village ? " — " + escapeHtml(m.village) : ""}</p>
            ${dateLine ? `<span class="news-card-date">${dateLine}</span>` : ""}
        </div>`;
    }).join("");
}

function updateMasaqiStatusSummary() {
    const critical = document.getElementById("masaqi-summary-critical");
    const progress = document.getElementById("masaqi-summary-progress");
    const done = document.getElementById("masaqi-summary-done");
    if (critical) critical.textContent = window.masaqiCache.filter(m => m.status === "تحتاج للتطهير").length;
    if (progress) progress.textContent = window.masaqiCache.filter(m => m.status === "قيد العمل").length;
    if (done) done.textContent = window.masaqiCache.filter(m => m.status === "تم التطهير").length;
}

// ============ التحديث الدوري (بديل onSnapshot) ============
export function initMasaqiListener() {
    pollCollection('/masaqi', (rows) => {
        window.masaqiCache = [...rows].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        window._loaded.masaqi = true;
        renderMasaqi();
        renderPublicMasaqiBoard();
        updateMasaqiStatusSummary();
    });
}
