// =====================================================================
// js/data/canals.js — نفس المنطق والواجهات بالظبط. الفرق: apiGet/Post/
// Put/Delete بدل db.collection...
//
// ملحوظة (إزالة): ميزة "سجل أعمال الترع" (اختيار ترعة وعرض/إضافة أحداث
// تاريخية بالحالة بعدها، عبر /api/canals/:id/history) اتشالت بالكامل
// من هنا ومن admin/canals.html بناءً على طلب صريح من الأمين — الحالة
// الحالية للترعة بتتحدَّث مباشرة من فورم الإضافة/التعديل (cn-status)
// زي أي حقل تاني، من غير سجل تاريخي منفصل. نقطة النهاية على السيرفر
// (/api/canals/:id/history) اتسابت زي ما هي عمداً — لسه بتُستخدم في
// طبقة النسخ الاحتياطي (data/backup.js) عشان أي بيانات تاريخية قديمة
// اتسجلت فعلاً متتفقدش من النسخ الاحتياطية، حتى بعد ما بقت غير معروضة.
// =====================================================================

import { apiPost, apiPut, apiDelete, pollCollection, bulkImport } from "../services/api.js";
import { showAlert, showConfirm } from "../utils/modal.js";
import { showToast } from "../utils/toast.js";
import { isDataEditor } from "../auth.js";
import { loadingRow, emptyRow, escapeHtml, setButtonLoading, resetButtonLoading, markInvalidFields, clearInvalidFields, normalizeText, syncDirectorateFilterOptions } from "../utils/ui-helpers.js";
import { icon } from "../icons.js";
import { isDateInCurrentWeek, getCurrentWeekLabel } from "../utils/week-filter.js";
import { openDetail, specGrid, mapsLink, notesBlock } from "../utils/detail-view.js";

const STATUS_ACCENT = {
    "حرجة": "accent-urgent",
    "جاري التطهير": "accent-progress",
    "تم التطهير": "accent-awareness",
    "لا تحتاج لتطهير": "accent-general",
};
const STATUS_BADGE = {
    "حرجة": "red",
    "جاري التطهير": "yellow",
    "تم التطهير": "green",
    "لا تحتاج لتطهير": "blue",
};

let editingSections = [];

// ============ الحفظ/التعديل/الحذف ============
export async function saveCanal() {
    const id = document.getElementById("cn-id").value;
    const isLined = document.getElementById("cn-is-lined").checked;
    const data = {
        name: document.getElementById("cn-name").value.trim(),
        directorate: document.getElementById("cn-directorate").value,
        feeder_canal: document.getElementById("cn-feeder").value.trim() || "",
        bank: document.getElementById("cn-bank").value || "",
        length: document.getElementById("cn-length").value.trim() || "",
        command_area: document.getElementById("cn-command-area").value.trim() || "",
        discharge_rate: document.getElementById("cn-discharge").value.trim() || "",
        lat: document.getElementById("cn-lat").value.trim() || "",
        lng: document.getElementById("cn-lng").value.trim() || "",
        status: document.getElementById("cn-status").value,
        next_scheduled_date: document.getElementById("cn-next-date").value.trim() || "",
        last_dredging_date: document.getElementById("cn-last-date").value.trim() || "",
        sections: editingSections,
        lining: {
            is_lined: isLined,
            lining_type: isLined ? document.getElementById("cn-lining-type").value.trim() || "" : "",
            lined_length: isLined ? document.getElementById("cn-lined-length").value.trim() || "" : "",
        },
        notes: document.getElementById("cn-notes").value.trim() || "",
    };
    clearInvalidFields(["cn-directorate", "cn-name"]);
    if (!data.name || !data.directorate) {
        markInvalidFields([!data.directorate ? "cn-directorate" : null, !data.name ? "cn-name" : null].filter(Boolean));
        showToast("⚠️ الرجاء إدخال اسم الترعة واختيار الهندسة.");
        return;
    }

    const dup = window.canalsCache.find(x => x.id !== id && x.name.trim() === data.name.trim() && x.directorate === data.directorate);
    if (dup) {
        const ok = await showConfirm(`يوجد بالفعل ترعة بنفس الاسم "${dup.name}" في ${dup.directorate}. هل أنت متأكد إن هذا سجل مختلف وتريد المتابعة؟`, "تنبيه من تكرار محتمل");
        if (!ok) return;
    }

    setButtonLoading("btn-save-canal", "⏳ جاري الحفظ...");
    try {
        if (id) await apiPut(`/canals/${id}`, data);
        else await apiPost("/canals", data);
        showToast(id ? "✅ تم تحديث بيانات الترعة." : "💾 تم حفظ الترعة.");
        cancelEditCanal();
    } catch (e) {
        console.error(e);
        showAlert(e.friendly ? e.message : "تعذر حفظ البيانات، حاول مرة أخرى.");
    } finally {
        resetButtonLoading("btn-save-canal");
    }
}

export function editCanalTrigger(id) {
    if (!isDataEditor()) return;
    const c = window.canalsCache.find(x => x.id === id);
    if (!c) return;
    document.getElementById("cn-id").value = c.id;
    document.getElementById("cn-directorate").value = formatDirectorate(c.directorate);
    document.getElementById("cn-name").value = c.name;
    document.getElementById("cn-feeder").value = c.feeder_canal || "";
    document.getElementById("cn-bank").value = c.bank || "";
    document.getElementById("cn-length").value = c.length || "";
    document.getElementById("cn-command-area").value = c.command_area || "";
    document.getElementById("cn-discharge").value = c.discharge_rate || "";
    document.getElementById("cn-lat").value = c.lat || "";
    document.getElementById("cn-lng").value = c.lng || "";
    document.getElementById("cn-status").value = c.status;
    document.getElementById("cn-next-date").value = c.next_scheduled_date || "";
    document.getElementById("cn-last-date").value = c.last_dredging_date || "";
    document.getElementById("cn-notes").value = c.notes || "";
    document.getElementById("cn-is-lined").checked = !!c.lining?.is_lined;
    document.getElementById("cn-lining-type").value = c.lining?.lining_type || "";
    document.getElementById("cn-lined-length").value = c.lining?.lined_length || "";
    toggleLiningFields();
    editingSections = Array.isArray(c.sections) ? [...c.sections] : [];
    renderSectionsEditor();
    document.getElementById("btn-save-canal").innerHTML = `${icon("save", 16)} تحديث`;
    document.getElementById("btn-cancel-edit-canal").style.display = "inline-block";
    document.getElementById("dialog-title").textContent = "تعديل بيانات الترعة";
    document.getElementById("form-dialog-overlay").classList.add("open");
}

export function cancelEditCanal() {
    ["cn-id", "cn-directorate", "cn-name", "cn-feeder", "cn-length", "cn-command-area",
     "cn-discharge", "cn-lat", "cn-lng", "cn-next-date", "cn-last-date", "cn-notes", "cn-lining-type", "cn-lined-length"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    document.getElementById("cn-bank").value = "";
    document.getElementById("cn-status").value = "لا تحتاج لتطهير";
    document.getElementById("cn-is-lined").checked = false;
    toggleLiningFields();
    editingSections = [];
    renderSectionsEditor();
    document.getElementById("btn-save-canal").innerHTML = `${icon("save", 16)} حفظ`;
    document.getElementById("btn-cancel-edit-canal").style.display = "none";
    document.getElementById("form-dialog-overlay")?.classList.remove("open");
}

export async function deleteCanal(id) {
    const ok = await showConfirm("حذف هذه الترعة وكل سجل أعمالها؟ لا يمكن التراجع عن هذا الإجراء.");
    if (!ok) return;
    try {
        await apiDelete(`/canals/${id}`);
        showToast("🗑️ تم حذف الترعة.");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر الحذف، حاول مرة أخرى.");
    }
}

// ============ استيراد Excel - الترع ============
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
                let name = r["الترعة"] || r["اسم الترعة"];
                if (!name) continue;
                let st = (r["الحالة"] || "").toString();
                let status = st.includes("تم") ? "تم التطهير" : st.includes("جاري") ? "جاري التطهير" : st.includes("حرج") ? "حرجة" : "لا تحتاج لتطهير";
                const dateVal = (v) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v || "");
                items.push({
                    name: String(name).trim(),
                    directorate: formatDirectorate(r["الهندسة"]) || "غير محدد",
                    feeder_canal: r["الترعة المغذية"] || "",
                    bank: r["البر"] || "",
                    length: r["الطول"] || r["الطول الكلي (كم)"] || "",
                    command_area: r["الزمام"] || r["الزمام (فدان)"] || "",
                    discharge_rate: r["القنن المائي"] || "",
                    status,
                    last_dredging_date: dateVal(r["آخر تطهير"] || r["تاريخ آخر تطهير"]),
                    next_scheduled_date: dateVal(r["الموعد القادم"]),
                    lat: r["خط العرض"] || "", lng: r["خط الطول"] || "",
                    sections: [], lining: { is_lined: false, lining_type: "", lined_length: "" },
                    notes: r["ملاحظات"] || "",
                });
            }
            showToast(`⏳ جاري استيراد ${items.length} ترعة، ثانية لحظات...`);
            const { done, failed, errors } = await bulkImport("/canals", items);
            if (failed === 0) showToast(`✅ اكتمل الاستيراد: ${done} ترعة بنجاح.`);
            else showAlert(`اكتمل الاستيراد جزئياً: ${done - failed} نجح، ${failed} فشل.\n\nتفاصيل الأخطاء:\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? `\n... و${errors.length - 8} خطأ إضافي` : ""}`);
        } catch (err) { console.error(err); showAlert("حدث خطأ في قراءة ملف Excel، تأكد من تنسيق الأعمدة."); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
}

// ============ محرِّر المقاطع الهندسية وبيانات المناوبة ============
export function addSectionRow() {
    editingSections.push({ from_km: "", to_km: "", bed_width: "", side_slope: "", bed_level: "", max_water: "", min_water: "", rotation: "" });
    renderSectionsEditor();
}
export function removeSectionRow(index) {
    editingSections.splice(index, 1);
    renderSectionsEditor();
}
export function updateSectionField(index, field, value) {
    if (editingSections[index]) editingSections[index][field] = value;
}
export function renderSectionsEditor() {
    const box = document.getElementById("cn-sections-editor");
    if (!box) return;
    if (editingSections.length === 0) {
        box.innerHTML = `<div style="padding:14px; text-align:center; color:var(--text-muted); font-size:0.78rem;">لا توجد مقاطع مُضافة بعد.</div>`;
        return;
    }
    box.innerHTML = editingSections.map((s, i) => `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(90px,1fr)); gap:6px; padding:10px; border:1px solid var(--border-light); border-radius:8px; margin-bottom:8px;">
            <input class="form-input" placeholder="من (كم)" value="${escapeHtml(s.from_km)}" oninput="updateSectionField(${i},'from_km',this.value)" />
            <input class="form-input" placeholder="إلى (كم)" value="${escapeHtml(s.to_km)}" oninput="updateSectionField(${i},'to_km',this.value)" />
            <input class="form-input" placeholder="عرض القاع" value="${escapeHtml(s.bed_width)}" oninput="updateSectionField(${i},'bed_width',this.value)" />
            <input class="form-input" placeholder="الميل الجانبي" value="${escapeHtml(s.side_slope)}" oninput="updateSectionField(${i},'side_slope',this.value)" />
            <input class="form-input" placeholder="منسوب القاع" value="${escapeHtml(s.bed_level)}" oninput="updateSectionField(${i},'bed_level',this.value)" />
            <input class="form-input" placeholder="أقصى منسوب مياه" value="${escapeHtml(s.max_water)}" oninput="updateSectionField(${i},'max_water',this.value)" />
            <input class="form-input" placeholder="أدنى منسوب مياه" value="${escapeHtml(s.min_water)}" oninput="updateSectionField(${i},'min_water',this.value)" />
            <select class="form-input" onchange="updateSectionField(${i},'rotation',this.value)">
                <option value="">المناوبة</option>
                <option value="أ" ${s.rotation === "أ" ? "selected" : ""}>أ</option>
                <option value="ب" ${s.rotation === "ب" ? "selected" : ""}>ب</option>
                <option value="جـ" ${s.rotation === "جـ" ? "selected" : ""}>جـ</option>
            </select>
            <button type="button" class="btn-icon" style="color:var(--danger);" onclick="removeSectionRow(${i})">🗑️ حذف المقطع</button>
        </div>
    `).join("");
}
export function toggleLiningFields() {
    const isLined = document.getElementById("cn-is-lined").checked;
    document.getElementById("cn-lining-fields").style.display = isLined ? "grid" : "none";
}

export function filterCanalsByStatus(status) {
    const select = document.getElementById("filter-canal-status");
    if (select) select.value = status;
    renderCanals();
    document.getElementById("canals-table")?.closest(".card-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============ عرض جدول الترع الموحَّد ============
// أسماء الهندسات في بيانات الترع الفعلية (المستوردة من سُقيا الأصلية)
// مخزَّنة بالاسم المجرَّد (زي "الرياح")، من غير بادئة "هندسة ري" —
// نفس اتفاقية سُقيا بالظبط. القائمة والفورم بقوا بنفس الاتفاقية دي من
// 1.2.1. الدالة دي بتجرّد أي بادئة "هندسة ري" لو لقتها (لأي سجل قديم
// اتضاف قبل التوحيد وكان لسه بالصيغة الطويلة) عشان الفلتر يفضل شغال
// مع الحالتين من غير ما يعتمد على تاريخ إضافة السجل.
function normDirectorate(v) {
    return normalizeText(v).replace(/^هندسة\s+ري\s+/, "");
}
// عكس normDirectorate تماماً: بيرجّع القيمة دايماً بالصيغة الكاملة
// "هندسة ري X" للعرض، سواء كانت القيمة المخزَّنة فعلياً مجرَّدة (زي
// سجلات سُقيا القديمة) أو كاملة بالفعل (سجلات مُضافة من الفورم الحالي).
// كده أي عرض للهندسة في الواجهة بيبقى متسق مع باقي الشاشات (زي
// المصارف والمساقي) حتى لو البيانات المخزَّنة نفسها مختلفة الصيغة.
function formatDirectorate(v) {
    const s = normalizeText(v);
    if (!s) return "";
    return /^هندسة\s+ري\s+/.test(s) ? s : `هندسة ري ${s}`;
}

export function renderCanals() {
    const search = (document.getElementById("filter-canal-search")?.value || "").toLowerCase();
    const dir = document.getElementById("filter-canal-directorate")?.value || "";
    const st = document.getElementById("filter-canal-status")?.value || "";
    const rot = document.getElementById("filter-canal-rotation")?.value || "";
    const tb = document.getElementById("canals-table-body");
    if (!tb) return;
    if (!window._loaded.canals) { tb.innerHTML = loadingRow(7); return; }
    let data = window.canalsCache.filter(c =>
        (!search || c.name?.toLowerCase().includes(search)) &&
        (!dir || normDirectorate(c.directorate) === normDirectorate(dir)) &&
        (!st || c.status === st) &&
        (!rot || getRotations(c).includes(rot))
    );
    const countEl = document.getElementById("canals-filtered-count");
    if (countEl) countEl.textContent = `${data.length} ترعة`;
    if (data.length === 0) { tb.innerHTML = emptyRow(7, "لا توجد نتائج مطابقة"); return; }
    tb.innerHTML = data.map(c => {
        // c.status ممكن يكون null (من قاعدة D1 لسجل لسه من غير أي حدث تطهير
        // مسجَّل — زي كل الترع بعد استعادة نسخة احتياطية قديمة)، ولو حطيناها
        // جوّه template literal من غير escape، JS بتحوّلها لنص "null" حرفي
        // بيظهر في الواجهة زي ما هو (ده كان الباج في الصورة). الحل: نص بديل
        // واضح للمستخدم بدل النص التقني.
        const badge = `<span class="badge ${STATUS_BADGE[c.status] || "blue"}">${escapeHtml(c.status) || "غير محدد"}</span>`;
        const liningBadge = c.lining?.is_lined ? `<span class="badge blue" title="${escapeHtml(c.lining.lining_type || "")}">مبطنة</span>` : `<span style="color:var(--text-muted);font-size:0.7rem;">غير مبطنة</span>`;
        const actions = isDataEditor()
            ? `<button class="btn-icon" onclick="viewCanalDetail('${c.id}')">👁️ عرض</button> <button class="btn-icon" onclick="editCanalTrigger('${c.id}')">✏️ تعديل</button> <button class="btn-icon" style="color:var(--danger)" onclick="deleteCanal('${c.id}')">🗑️ حذف</button>`
            : `<button class="btn-icon" onclick="viewCanalDetail('${c.id}')">👁️ عرض التفاصيل</button>`;
        return `<tr class="${c.status === "حرجة" ? "critical-alert" : ""}">
            <td data-label="الترعة"><b style="cursor:pointer;color:var(--nile-dark)" onclick="viewCanalDetail('${c.id}')">${escapeHtml(c.name)}</b></td>
            <td data-label="الهندسة">${escapeHtml(formatDirectorate(c.directorate))}</td>
            <td data-label="الطول (كم)">${escapeHtml(c.length) || "-"}</td>
            <td data-label="الحالة">${badge}</td>
            <td data-label="التبطين">${liningBadge}</td>
            <td data-label="آخر تطهير">${escapeHtml(c.last_dredging_date) || "-"}</td>
            <td data-label="إجراءات">${actions}</td>
        </tr>`;
    }).join("");
}

// ============ لوحة المنتفعين العامة ============
function isCanalRelevantThisWeek(c) {
    if (c.status === "جاري التطهير") return true;
    if (c.status === "تم التطهير") return isDateInCurrentWeek(c.last_dredging_date);
    return false;
}

export function renderPublicCanalBoard() {
    const grid = document.getElementById("canal-board-grid");
    const summaryEl = document.getElementById("canal-board-date");
    const todayEl = document.getElementById("canal-board-today");
    if (!grid) return;
    if (todayEl) todayEl.textContent = `أعمال هذا الأسبوع (${getCurrentWeekLabel()})`;
    if (!window._loaded.canals) {
        grid.innerHTML = '<div class="news-card-empty">⏳ جاري تحميل بيانات الترع...</div>';
        if (summaryEl) summaryEl.textContent = "⏳ جاري تحميل بيانات الترع...";
        return;
    }
    const dir = document.getElementById("canal-board-directorate-filter")?.value || "";
    const all = window.canalsCache.filter(isCanalRelevantThisWeek);
    if (summaryEl) {
        summaryEl.textContent = all.length > 0 ? `🔧 ${all.length} ترعة جاري أو تم تطهيرها هذا الأسبوع` : "لا توجد أعمال تطهير مسجّلة هذا الأسبوع";
    }
    const data = all.filter(c => !dir || normDirectorate(c.directorate) === normDirectorate(dir));
    if (data.length === 0) {
        grid.innerHTML = `<div class="news-card-empty">${all.length === 0 ? "لا توجد أعمال تطهير مسجّلة هذا الأسبوع" : "لا توجد نتائج لهذه الهندسة"}</div>`;
        return;
    }
    const order = { "جاري التطهير": 0, "تم التطهير": 1 };
    const sorted = [...data].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    grid.innerHTML = sorted.map(c => {
        const accent = STATUS_ACCENT[c.status] || "accent-general";
        const badgeColor = STATUS_BADGE[c.status] || "blue";
        const dateLine = c.status === "تم التطهير"
            ? (c.last_dredging_date ? `تاريخ التطهير: ${escapeHtml(c.last_dredging_date)}` : "")
            : (c.next_scheduled_date ? `الموعد المقرر: ${escapeHtml(c.next_scheduled_date)}` : "");
        return `<div class="news-card ${accent}">
            <span class="news-card-badge ${badgeColor}">${escapeHtml(c.status) || "غير محدد"}</span>
            <h4>${escapeHtml(c.name)}</h4>
            <p>${escapeHtml(formatDirectorate(c.directorate))}</p>
            ${dateLine ? `<span class="news-card-date">${dateLine}</span>` : ""}
        </div>`;
    }).join("");
}

// ============ كرت عرض التفاصيل الكامل (مقاطع + تبطين + قطاع عرضي) ============
// نفس التصميم اللي كان موجود في سُقيا قبل الدمج (المستخدم طلب رجوعه):
// شبكة بيانات أساسية، بيانات التبطين لو مبطنة، رسم القطاع العرضي لأول
// مقطع له عرض قاع، وجدول/كروت لكل المقاطع الهندسية.
function fixSideSlope(val) {
    if (!val) return "";
    const s = String(val).trim();
    const m = s.match(/^(\d{1,2}):(\d{2}):00$/);
    if (m) { const h = parseInt(m[1]), mi = parseInt(m[2]); return mi === 0 ? String(h) : `${h}:${mi}`; }
    return s;
}
function rotBadgeHtml(rotations) {
    return rotations.map(r => `<span class="rot-badge">${escapeHtml(r)}</span>`).join(" ");
}
function getRotations(c) {
    const rots = new Set();
    (c.sections || []).forEach(s => { const r = (s.rotation || "").trim(); if (r) rots.add(r); });
    return [...rots].sort();
}
function drawCanalCross(sec) {
    const cv = document.getElementById("ccv");
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(cv.clientWidth) || 560;
    const H = Math.max(150, Math.min(Math.round(W * 0.4), 260));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
    const bw = parseFloat(sec.bed_width) || 1;
    let hz = 1;
    const ssRaw = fixSideSlope(sec.side_slope) || "";
    if (ssRaw.includes(":")) hz = (parseFloat(ssRaw.split(":")[0]) || 1) / (parseFloat(ssRaw.split(":")[1]) || 1);
    else hz = parseFloat(ssRaw) || 1;
    if (!isFinite(hz) || hz > 12) hz = 1;
    const bl = parseFloat(sec.bed_level) || 22, mx = parseFloat(sec.max_water) || (bl + 1.5), mn = parseFloat(sec.min_water) || (bl + 1);
    const dep = Math.max(mx - bl, 0.5), cx = W / 2, bedY = H - 34, dH = bedY - 28;
    const sc = Math.min((W - 20) / (bw + 2 * hz * dep + 4), dH / dep * 0.7);
    const gndY = bedY - dep * sc, bL = cx - bw / 2 * sc, bR = cx + bw / 2 * sc, tL = bL - hz * dep * sc, tR = bR + hz * dep * sc;
    // التربة
    ctx.fillStyle = "#d4a96a";
    ctx.beginPath(); ctx.moveTo(0, gndY); ctx.lineTo(tL, gndY); ctx.lineTo(bL, bedY); ctx.lineTo(bR, bedY); ctx.lineTo(tR, gndY); ctx.lineTo(W, gndY); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // الماء (أقصى منسوب)
    const wY = bedY - (mx - bl) * sc;
    const wL = bL - (bedY - wY) * hz, wR = bR + (bedY - wY) * hz;
    ctx.fillStyle = "rgba(30,90,122,0.55)";
    ctx.beginPath(); ctx.moveTo(wL, wY); ctx.lineTo(wR, wY); ctx.lineTo(bR, bedY); ctx.lineTo(bL, bedY); ctx.closePath(); ctx.fill();
    // منسوب المياه الأدنى (خط متقطع)
    if (mn && mn !== mx) {
        const wY2 = bedY - (mn - bl) * sc;
        ctx.strokeStyle = "#0277bd"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(wL - 10, wY2); ctx.lineTo(wR + 10, wY2); ctx.stroke(); ctx.setLineDash([]);
    }
    // خط القاع
    ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bL, bedY); ctx.lineTo(bR, bedY); ctx.stroke();
    // نصوص القياسات
    ctx.fillStyle = "#1a2219"; ctx.font = "11px Cairo, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`عرض القاع: ${bw} م`, cx, bedY + 18);
    ctx.fillText(`الميل: ${ssRaw || "—"}`, cx, gndY - 8 < 14 ? 14 : gndY - 8);
}

function buildCanalDetailBody(c) {
    const sections = Array.isArray(c.sections) ? c.sections : [];
    const firstSectionWithWidth = sections.find(s => s.bed_width && parseFloat(s.bed_width) > 0) || sections[0] || null;
    const rots = getRotations(c);
    const lining = c.lining || {};
    const isLined = !!lining.is_lined;

    let html = specGrid([
        { label: "الهندسة", value: formatDirectorate(c.directorate) },
        { label: "الطول الكلي", html: `${escapeHtml(c.length) || "—"} كم` },
        { label: "الزمام", html: c.command_area ? `${Number(c.command_area).toLocaleString("ar-EG")} فدان` : "—" },
        { label: "القنن المائي", html: `${escapeHtml(c.discharge_rate) || "—"} م³` },
        { label: "الترعة المغذية", value: c.feeder_canal },
        { label: "البر", value: c.bank },
        { label: "المناوبات", html: rots.length ? rotBadgeHtml(rots) : "—" },
        { label: "عدد المقاطع", value: sections.length || "—" },
        { label: "الحالة", html: `<span class="badge ${STATUS_BADGE[c.status] || "blue"}">${escapeHtml(c.status) || "غير محدد"}</span>` },
        { label: "التبطين", html: isLined ? `<span class="badge blue">مبطنة</span>` : `<span class="badge yellow">غير مبطنة</span>` },
    ]);

    if (isLined) {
        html += `<div class="lining-block"><h4>بيانات التبطين</h4>${specGrid([
            { label: "نوع التبطين", value: lining.lining_type },
            { label: "الطول المُبطَّن (كم)", value: lining.lined_length },
        ])}</div>`;
    }

    if (firstSectionWithWidth && firstSectionWithWidth.bed_width) {
        html += `<div class="cross-canvas-wrap">
            <div style="font-size:0.68rem;font-weight:800;color:var(--text-faint);text-align:center;margin-bottom:6px">
                القطاع العرضي — كم ${escapeHtml(firstSectionWithWidth.from_km) || "؟"} → ${escapeHtml(firstSectionWithWidth.to_km) || "؟"}
            </div>
            <canvas id="ccv" style="display:block;width:100%"></canvas>
        </div>`;
    }

    if (sections.length) {
        html += `<div class="sections-block-title">المقاطع الهندسية (${sections.length})</div>
        <div class="sections-desktop" style="overflow-x:auto"><table class="sections-tbl"><thead><tr>
            <th>من كم</th><th>إلى كم</th><th>عرض القاع</th><th>الميل</th><th>منسوب القاع</th><th>أقصى منسوب</th><th>أقل منسوب</th><th>المناوبة</th>
        </tr></thead><tbody>
        ${sections.map(s => `<tr>
            <td>${escapeHtml(s.from_km) || "—"}</td><td>${escapeHtml(s.to_km) || "—"}</td>
            <td style="color:var(--nile-dark);font-weight:700">${escapeHtml(s.bed_width) || "—"}</td>
            <td>${escapeHtml(fixSideSlope(s.side_slope)) || "—"}</td>
            <td style="color:var(--danger);font-weight:700">${escapeHtml(s.bed_level) || "—"}</td>
            <td style="color:var(--success);font-weight:700">${escapeHtml(s.max_water) || "—"}</td>
            <td style="color:var(--info);font-weight:700">${escapeHtml(s.min_water) || "—"}</td>
            <td>${s.rotation ? `<span class="rot-badge">${escapeHtml(s.rotation)}</span>` : "—"}</td>
        </tr>`).join("")}
        </tbody></table></div>
        <div class="sections-mobile">${sections.map((s, i) => `<div class="section-card">
            <div class="section-card-head"><span>مقطع ${i + 1} (${escapeHtml(s.from_km) || "؟"} → ${escapeHtml(s.to_km) || "؟"})</span><span class="rot-badge">${escapeHtml(s.rotation) || "—"}</span></div>
            <div class="section-card-grid">
                <div><span class="sk">عرض القاع</span><span class="sv2">${escapeHtml(s.bed_width) || "—"}</span></div>
                <div><span class="sk">الميل</span><span class="sv2">${escapeHtml(fixSideSlope(s.side_slope)) || "—"}</span></div>
                <div><span class="sk">منسوب القاع</span><span class="sv2">${escapeHtml(s.bed_level) || "—"}</span></div>
                <div><span class="sk">أقصى منسوب</span><span class="sv2">${escapeHtml(s.max_water) || "—"}</span></div>
            </div>
        </div>`).join("")}</div>`;
    }

    html += notesBlock(c.notes) + mapsLink(c.lat, c.lng);
    return html;
}

export function viewCanalDetail(id) {
    const c = window.canalsCache.find(x => x.id === id);
    if (!c) return;
    const fs = (Array.isArray(c.sections) ? c.sections : []).find(s => s.bed_width && parseFloat(s.bed_width) > 0);
    openDetail(`${icon("tractor", 18)} ${escapeHtml(c.name)}`, buildCanalDetailBody(c));
    if (fs && fs.bed_width) setTimeout(() => drawCanalCross(fs), 60);
}

// ============ ملخّص الحالة (كروت "حرجة/جاري التطهير/تم التطهير/الإجمالي") ============
export function updateCanalsStatusSummary() {
    const critical = document.getElementById("canals-summary-critical");
    const progress = document.getElementById("canals-summary-progress");
    const done = document.getElementById("canals-summary-done");
    const total = document.getElementById("canals-summary-total");
    if (critical) critical.textContent = window.canalsCache.filter(c => c.status === "حرجة").length;
    if (progress) progress.textContent = window.canalsCache.filter(c => c.status === "جاري التطهير").length;
    if (done) done.textContent = window.canalsCache.filter(c => c.status === "تم التطهير").length;
    if (total) total.textContent = window.canalsCache.length;
}

// ============ التحديث الدوري (بديل onSnapshot) ============
let stopPolling = null;
export function initCanalsListener() {
    if (stopPolling) return;
    stopPolling = pollCollection("/canals", (rows) => {
        window.canalsCache = [...rows].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        window._loaded.canals = true;
        // بنبعت نسخة من السجلات بالصيغة الكاملة "هندسة ري X" (بعد إضافة
        // البادئة لو ناقصة) — عشان أي سجل قديم بالاسم المجرَّد (زي "الرياح")
        // يتقارن صح مع خيارات القائمة الكاملة الموجودة أصلاً، من غير ما
        // يضيف نسخة تانية مجرَّدة تبقى شكلها "تكرار" لنفس الهندسة.
        syncDirectorateFilterOptions("filter-canal-directorate", window.canalsCache.map(c => ({ directorate: formatDirectorate(c.directorate) })));
        renderCanals();
        renderPublicCanalBoard();
        updateCanalsStatusSummary();
    });
}
export function stopCanalsListener() {
    if (stopPolling) { stopPolling(); stopPolling = null; }
    window.canalsCache = [];
    window._loaded.canals = false;
}
