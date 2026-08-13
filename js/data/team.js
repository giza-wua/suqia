// =====================================================================
// data/team.js — إدارة المستخدمين، بديل أبسط جوهرياً من الأصل (مفيش
// حساب Firebase منفصل ولا secondaryAuth، مجرد INSERT واحد في users).
//
// تغيير سلوك واحد يستاهل التنويه: "إعادة تعيين كلمة المرور" في الأصل
// كانت بترسل رابط Firebase الرسمي على بريد المستخدم. مفيش خدمة إرسال
// بريد في الـ Worker حالياً، فبدلها المدير بيدخل كلمة مرور جديدة
// مباشرة (عبر prompt نصي) وتتفعّل فوراً — أبسط، لكن لازم يبلّغ
// المستخدم بيها يدوياً (تليفون/واتساب) بدل ما توصله تلقائياً بالبريد.
// =====================================================================

import { apiGet, apiPost, apiPut, apiDelete, pollCollection } from '../services/api.js';
import { showAlert, showConfirm } from '../utils/modal.js';
import { showToast } from '../utils/toast.js';
import { loadingRow, emptyRow, escapeHtml } from '../utils/ui-helpers.js';
import { normalizeUsername, normalizePhone } from '../utils/identity.js';

const ROLE_LABEL_TEXT = { admin: "مدير عام", editor: "مدخل بيانات", viewer: "مشاهد فقط" };

// ============ إضافة مستخدم جديد ============
export async function addTeamMember() {
    const name = document.getElementById("team-name").value.trim();
    const usernameRaw = document.getElementById("team-username").value.trim();
    const phoneRaw = document.getElementById("team-phone").value.trim();
    const emailRaw = document.getElementById("team-email").value.trim().toLowerCase();
    const pass = document.getElementById("team-pass").value.trim();
    const role = document.getElementById("team-role").value;

    const username = normalizeUsername(usernameRaw);
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    const hasRealEmail = !!emailRaw;

    if (!name || !username || !pass) { showAlert("من فضلك أكمل الاسم واسم المستخدم وكلمة المرور."); return; }
    if (phoneRaw && !phone) { showAlert("رقم الموبايل غير صحيح، أدخل رقماً مصرياً صحيحاً (مثال: 01012345678) أو اتركه فارغاً."); return; }
    if (hasRealEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) { showAlert("صيغة البريد الإلكتروني غير صحيحة، أو اتركه فارغاً تماماً إن لم يكن له بريد."); return; }

    if (!hasRealEmail) {
        const ok = await showConfirm(`لم يُدخَل بريد إلكتروني لـ "${name}"، بمعنى أنه في حال نسيان كلمة المرور مستقبلاً، الحل الوحيد هو أن يدخل المدير كلمة مرور جديدة له يدوياً من هنا. هل تريد المتابعة؟`);
        if (!ok) return;
    }

    try {
        await apiPost('/users', { name, username, phone, email: hasRealEmail ? emailRaw : null, password: pass, role });
        showToast("✅ تم إضافة المستخدم، وأصبح بإمكانه الدخول باسم المستخدم فوراً.");
        document.getElementById("team-name").value = "";
        document.getElementById("team-username").value = "";
        document.getElementById("team-phone").value = "";
        document.getElementById("team-email").value = "";
        document.getElementById("team-pass").value = "";
        document.getElementById("form-dialog-overlay")?.classList.remove("open");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر إضافة المستخدم، حاول مرة أخرى.");
    }
}

// ============ تحديث الصلاحية ============
export async function updateTeamRole(uid, role) {
    try {
        await apiPut(`/users/${uid}/role`, { role });
        showToast("✅ تم تحديث الصلاحية.");
    } catch (e) { showAlert(e.friendly ? e.message : "تعذر تحديث الصلاحية."); }
}

// ============ حذف مستخدم (إبطال صلاحيته على المنصة) ============
export async function deleteTeamMember(uid) {
    const target = window.teamCache.find(t => t.id === uid);
    const ok = await showConfirm(`هل تريد إبطال صلاحية "${target ? target.display_name : uid}" على المنصة؟`);
    if (!ok) return;
    try {
        await apiDelete(`/users/${uid}`);
        showToast("🗑️ تم إبطال صلاحية المستخدم.");
    } catch (e) { showAlert(e.friendly ? e.message : "تعذر تنفيذ العملية."); }
}

// ============ إعادة تعيين كلمة المرور (يدوياً من المدير) ============
export async function resetTeamPassword(uid) {
    const t = window.teamCache.find(x => x.id === uid);
    const newPass = prompt(`أدخل كلمة مرور جديدة لـ "${t ? t.display_name : uid}" (6 أحرف على الأقل)، وأبلغه بها بنفسك بعد الحفظ:`);
    if (!newPass) return;
    if (newPass.length < 6) { showAlert("كلمة المرور قصيرة جداً، 6 أحرف على الأقل."); return; }
    try {
        await apiPut(`/users/${uid}/reset-password`, { password: newPass });
        showToast("🔑 تم تعيين كلمة المرور الجديدة. أبلغ المستخدم بها الآن.");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر إعادة تعيين كلمة المرور، حاول مرة أخرى.");
    }
}

// ============ عرض جدول المستخدمين ============
export function renderTeam() {
    const tb = document.getElementById("team-table-body");
    if (!tb) return;
    if (!window._loaded.team) { tb.innerHTML = loadingRow(4); return; }
    if (window.teamCache.length === 0) { tb.innerHTML = emptyRow(4, "لا يوجد مستخدمون"); return; }
    const ROLE_BADGE = { admin: ["green", "مدير عام"], editor: ["yellow", "مدخل بيانات"], viewer: ["blue", "مشاهد فقط"] };
    tb.innerHTML = window.teamCache.map(t => {
        const youBadge = t.id === window.currentUid ? ' <span class="badge blue">أنت</span>' : "";
        const [badgeColor, badgeText] = ROLE_BADGE[t.role] || ROLE_BADGE.viewer;
        const roleCell = t.id === window.currentUid
            ? `<span class="badge ${badgeColor}">${badgeText}</span>`
            : `<select class="role-badge-select" onchange="updateTeamRole('${t.id}', this.value)">
                <option value="admin" ${t.role === "admin" ? "selected" : ""}>🛠️ مدير عام</option>
                <option value="editor" ${t.role === "editor" ? "selected" : ""}>✍️ مدخل بيانات</option>
                <option value="viewer" ${t.role === "viewer" ? "selected" : ""}>👁️ مشاهد فقط</option>
               </select>`;
        const deleteBtn = t.id === window.currentUid ? "" : `<button class="btn-icon" style="color:var(--danger)" onclick="deleteTeamMember('${t.id}')">🗑️ إبطال</button>`;
        const noEmailBadge = t.has_real_email === false || t.has_real_email === 0 ? ' <span class="badge yellow" title="بدون بريد استعادة">بلا بريد</span>' : "";
        const loginIdCell = `<div style="direction:ltr;text-align:right;">@${escapeHtml(t.username) || "—"}</div>${t.phone ? `<div style="direction:ltr;text-align:right;color:var(--text-muted);font-size:0.72rem;">${escapeHtml(t.phone)}</div>` : ""}${noEmailBadge}`;
        return `<tr>
            <td data-label="الاسم"><b>${escapeHtml(t.display_name) || escapeHtml(t.username) || t.id}</b>${youBadge}</td>
            <td data-label="بيانات الدخول">${loginIdCell}</td>
            <td data-label="الصلاحية">${roleCell}</td>
            <td data-label="إجراءات"><button class="btn-icon" onclick="resetTeamPassword('${t.id}')">🔑 كلمة مرور</button> ${deleteBtn}</td>
        </tr>`;
    }).join("");
}

// ============ التحديث الدوري (بديل onSnapshot) ============
let stopPolling = null;
export function initTeamListener() {
    if (stopPolling) return;
    stopPolling = pollCollection('/users', (rows) => {
        window.teamCache = rows;
        window._loaded.team = true;
        renderTeam();
    });
}
export function stopTeamListener() {
    if (stopPolling) { stopPolling(); stopPolling = null; }
    window.teamCache = []; window._loaded.team = false;
}
