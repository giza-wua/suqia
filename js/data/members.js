// =====================================================================
// data/members.js — نفس المنطق بالظبط، apiPost/apiPut/apiDelete بدل
// db.collection...، polling بدل onSnapshot.
// =====================================================================

import { apiPost, apiPut, apiDelete, pollCollection, bulkImport } from '../services/api.js';
import { showAlert, showConfirm } from '../utils/modal.js';
import { showToast } from '../utils/toast.js';
import { isDataEditor } from '../auth.js';
import { loadingRow, emptyRow, escapeHtml, setButtonLoading, resetButtonLoading, markInvalidFields, clearInvalidFields } from '../utils/ui-helpers.js';
import { icon } from '../icons.js';

// ============ الأعضاء ============
export async function saveMember() {
    const id = document.getElementById("m-id").value;
    let role;
    const roleSelect = document.getElementById("m-role");
    const roleOtherInput = document.getElementById("m-role-other");
    if (roleOtherInput && roleOtherInput.style.display !== "none" && roleOtherInput.value.trim()) {
        role = roleOtherInput.value.trim();
    } else {
        role = roleSelect.value;
    }
    if (role === "__OTHER__") role = "";
    const data = {
        name: document.getElementById("m-name").value.trim(),
        phone: document.getElementById("m-phone").value.trim(),
        national_id: document.getElementById("m-national-id").value.trim(),
        directorate: document.getElementById("m-directorate").value,
        village: document.getElementById("m-village").value.trim() || "غير محدد",
        role: role,
        masqa: document.getElementById("m-masqa").value.trim() || "غير محدد",
        holding: document.getElementById("m-holding").value.trim() || "0",
    };
    clearInvalidFields(["m-name", "m-phone"]);
    if (!data.name || !data.phone) {
        markInvalidFields([!data.name ? "m-name" : null, !data.phone ? "m-phone" : null].filter(Boolean));
        showToast("⚠️ الرجاء إدخال الاسم والهاتف.");
        return;
    }

    const dup = window.membersCache.find(x => x.id !== id && x.name.trim() === data.name && (x.phone === data.phone || (data.national_id && x.national_id === data.national_id)));
    if (dup) {
        const ok = await showConfirm(`يوجد بالفعل عضو بنفس الاسم ونفس الهاتف أو الرقم القومي: "${dup.name}". هل أنت متأكد إن هذا سجل مختلف وتريد المتابعة؟`, "تنبيه من تكرار محتمل");
        if (!ok) return;
    }

    setButtonLoading("btn-save-member", "⏳ جاري الحفظ...");
    try {
        if (id) await apiPut(`/members/${id}`, data);
        else await apiPost('/members', data);
        showToast(id ? "✅ تم تحديث بيانات العضو." : "👤 تم حفظ العضو.");
        cancelEditMember(!id);
        if (!id) document.getElementById("m-name")?.focus();
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر حفظ البيانات، حاول مرة أخرى.");
    } finally {
        resetButtonLoading("btn-save-member");
    }
}

export function editMemberTrigger(id) {
    if (!isDataEditor()) return;
    const m = window.membersCache.find(x => x.id === id);
    if (!m) return;
    document.getElementById("m-id").value = m.id;
    document.getElementById("m-name").value = m.name || "";
    document.getElementById("m-phone").value = m.phone || "";
    document.getElementById("m-national-id").value = m.national_id || "";
    document.getElementById("m-directorate").value = m.directorate || "هندسة ري مزغونة";
    document.getElementById("m-village").value = m.village || "";
    const roleSelect = document.getElementById("m-role");
    const roleOtherInput = document.getElementById("m-role-other");
    let foundRole = false;
    if (roleSelect) {
        for (let opt of roleSelect.options) if (opt.value === m.role) { foundRole = true; break; }
        if (foundRole) {
            roleSelect.value = m.role; roleSelect.style.display = "";
            if (roleOtherInput) { roleOtherInput.style.display = "none"; roleOtherInput.value = ""; }
        } else if (roleOtherInput) {
            roleSelect.value = "__OTHER__"; roleSelect.style.display = "none";
            roleOtherInput.style.display = ""; roleOtherInput.value = m.role || "";
        }
    }
    document.getElementById("m-masqa").value = m.masqa || "";
    document.getElementById("m-holding").value = m.holding || "";
    document.getElementById("btn-save-member").innerHTML = `${icon("save", 16)} تحديث`;
    document.getElementById("btn-cancel-edit-member").style.display = "inline-block";
    document.getElementById("dialog-title").textContent = "تعديل بيانات العضو";
    document.getElementById("form-dialog-overlay").classList.add("open");
}

export function cancelEditMember(keepOpen) {
    document.getElementById("m-id").value = "";
    ["m-name", "m-phone", "m-national-id", "m-village", "m-role", "m-masqa", "m-holding"].forEach(id => document.getElementById(id).value = "");
    const roleSelect = document.getElementById("m-role");
    const roleOtherInput = document.getElementById("m-role-other");
    if (roleSelect) roleSelect.style.display = "";
    if (roleOtherInput) { roleOtherInput.style.display = "none"; roleOtherInput.value = ""; }
    document.getElementById("btn-save-member").innerHTML = `${icon("save", 16)} حفظ العضو`;
    document.getElementById("btn-cancel-edit-member").style.display = "none";
    if (!keepOpen) document.getElementById("form-dialog-overlay")?.classList.remove("open");
}

export async function deleteMember(id) {
    const ok = await showConfirm("هل تريد حذف هذا العضو؟");
    if (!ok) return;
    try {
        await apiDelete(`/members/${id}`);
        showToast("🗑️ تم حذف العضو.");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر الحذف، حاول مرة أخرى.");
    }
}

// ============ استيراد Excel - الأعضاء ============
export async function handleExcelImportMembers(event) {
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
                let name = r["الاسم"] || r["الاسم بالكامل"] || r["اسم العضو"];
                if (!name) continue;
                items.push({
                    name: String(name).trim(),
                    phone: String(r["الهاتف"] || r["رقم الهاتف"] || "").trim() || "غير مسجل",
                    national_id: String(r["الرقم القومي"] || "").trim(),
                    directorate: r["الهندسة"] || "غير محدد",
                    village: r["القرية"] || "غير محدد",
                    role: r["الصفة"] || "عضو",
                    masqa: r["المجرى"] || r["المسقى"] || "غير محدد",
                    holding: String(r["الحيازة"] || "0").trim(),
                });
            }
            showToast(`⏳ جاري استيراد ${items.length} عضو، ثانية لحظات...`);
            const { done, failed, errors } = await bulkImport('/members', items);
            if (failed === 0) showToast(`✅ اكتمل الاستيراد: ${done} عضو بنجاح.`);
            else showAlert(`اكتمل الاستيراد جزئياً: ${done - failed} نجح، ${failed} فشل.\n\nتفاصيل الأخطاء:\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? `\n... و${errors.length - 8} خطأ إضافي` : ""}`);
        } catch (err) { console.error(err); showAlert("حدث خطأ في قراءة ملف Excel، تأكد من تنسيق الأعمدة."); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
}

// ============ عرض جدول الأعضاء ============
export function renderMembers() {
    const search = (document.getElementById("filter-member-search")?.value || "").toLowerCase();
    const dir = document.getElementById("filter-member-directorate")?.value || "";
    const tb = document.getElementById("members-table-body");
    if (!tb) return;
    if (!window._loaded.members) { tb.innerHTML = loadingRow(8); return; }
    let data = window.membersCache.filter(m => (!search || m.name?.toLowerCase().includes(search)) && (!dir || m.directorate === dir));
    if (data.length === 0) { tb.innerHTML = emptyRow(8, "لا يوجد أعضاء مطابقون"); return; }
    tb.innerHTML = data.map(m => {
        const actions = isDataEditor()
            ? `<button class="btn-icon" onclick="editMemberTrigger('${m.id}')">✏️ تعديل</button> <button class="btn-icon" style="color:var(--danger)" onclick="deleteMember('${m.id}')">🗑️ حذف</button>`
            : `<span style="color:var(--text-muted);font-size:0.7rem;">👁️ عرض فقط</span>`;
        return `<tr>
            <td data-label="الاسم"><b>${escapeHtml(m.name)}</b></td>
            <td data-label="الصفة"><span class="badge blue">${escapeHtml(m.role)}</span></td>
            <td data-label="الهندسة">${escapeHtml(m.directorate)}</td>
            <td data-label="القرية">${escapeHtml(m.village)}</td>
            <td data-label="المسقى">${escapeHtml(m.masqa)}</td>
            <td data-label="الهاتف">${escapeHtml(m.phone)}</td>
            <td data-label="الحيازة">${escapeHtml(m.holding)} فدان</td>
            <td data-label="إجراءات">${actions}</td>
        </tr>`;
    }).join("");
}

// ============ التحديث الدوري (بديل onSnapshot، مُقيَّد لأعضاء الفريق) ============
let stopPolling = null;
function updateMembersSummary() {
    const total = document.getElementById("members-summary-total");
    const holding = document.getElementById("members-summary-holding");
    const dirCount = document.getElementById("members-summary-dir");
    if (total) total.textContent = window.membersCache.length;
    if (holding) {
        const sum = window.membersCache.reduce((s, m) => s + (parseFloat(m.holding) || 0), 0);
        holding.textContent = sum ? sum.toLocaleString("ar-EG") : "0";
    }
    if (dirCount) dirCount.textContent = new Set(window.membersCache.map(m => m.directorate).filter(Boolean)).size;
}

export function initMembersListener() {
    if (stopPolling) return;
    stopPolling = pollCollection('/members', (rows) => {
        window.membersCache = rows;
        window._loaded.members = true;
        renderMembers();
        updateMembersSummary();
    });
}
export function stopMembersListener() {
    if (stopPolling) { stopPolling(); stopPolling = null; }
    window.membersCache = []; window._loaded.members = false;
}
