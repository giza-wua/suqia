// =====================================================================
// data/tickets.js — نفس المنطق بالظبط. حماية السبام المحلية (honeypot +
// حد أدنى للوقت + cooldown محلي) فضلت كطبقة أولى سريعة بدون شبكة؛
// الحماية الحقيقية الآن على السيرفر بالـ IP (راجع routes/tickets.js في
// الـ Worker) وهي اللي بتقرر فعلياً، فلو تخطى حد الـ localStorage
// (بمسحه مثلاً) السيرفر برضه هيرفض بـ 429.
// =====================================================================

import { apiPost, apiPut, pollCollection } from '../services/api.js';
import { showAlert } from '../utils/modal.js';
import { showToast } from '../utils/toast.js';
import { isDataEditor } from '../auth.js';
import { loadingRow, emptyRow, markInvalidFields, clearInvalidFields, escapeHtml } from '../utils/ui-helpers.js';
import { addNotification } from '../utils/notifications.js';

const FORM_LOAD_TIME = Date.now();
const TICKET_COOLDOWN_MS = 60 * 1000;
const TICKET_COOLDOWN_KEY = "zimam_last_ticket_at";

function ticketSpamCheck() {
    const honeypot = document.getElementById("f-hp");
    if (honeypot && honeypot.value.trim()) return "silent";
    if (Date.now() - FORM_LOAD_TIME < 3000) return "silent";
    try {
        const last = Number(localStorage.getItem(TICKET_COOLDOWN_KEY) || 0);
        if (Date.now() - last < TICKET_COOLDOWN_MS) return "cooldown";
    } catch (e) { /* ignore */ }
    return null;
}

function showTicketSuccessCard() {
    const formCard = document.getElementById("ticket-form-card");
    const successCard = document.getElementById("ticket-success-card");
    if (formCard && successCard) { formCard.style.display = "none"; successCard.style.display = "block"; }
    else showToast("🚀 تم تسجيل البلاغ!");
}

export function resetTicketForm() {
    const formCard = document.getElementById("ticket-form-card");
    const successCard = document.getElementById("ticket-success-card");
    if (formCard) formCard.style.display = "block";
    if (successCard) successCard.style.display = "none";
}

export async function submitFarmerTicket() {
    const spam = ticketSpamCheck();
    if (spam === "silent") { showTicketSuccessCard(); return; }
    if (spam === "cooldown") { showToast("⏳ تم إرسال بلاغ من هذا الجهاز مؤخراً، برجاء الانتظار قليلاً قبل إرسال بلاغ آخر."); return; }

    const name = document.getElementById("f-name").value.trim();
    const watercourse = document.getElementById("f-watercourse").value;
    clearInvalidFields(["f-name", "f-watercourse"]);
    if (!name || !watercourse) {
        markInvalidFields([!name ? "f-name" : null, !watercourse ? "f-watercourse" : null].filter(Boolean));
        showToast("⚠️ الرجاء إدخال الاسم واختيار المجرى المائي.");
        return;
    }
    const btn = document.getElementById("btn-submit-ticket");
    btn.disabled = true; btn.textContent = "⏳ جاري الإرسال...";
    try {
        await apiPost('/tickets', {
            farmer_name: name,
            phone: document.getElementById("f-phone").value.trim() || "غير مسجل",
            directorate: document.getElementById("f-directorate").value,
            watercourse: watercourse,
            issue_type: document.getElementById("f-type").value,
            gps: document.getElementById("f-gps").value,
            description: document.getElementById("f-desc").value.trim() || "لا يوجد وصف",
        });
        try { localStorage.setItem(TICKET_COOLDOWN_KEY, String(Date.now())); } catch (e) { /* ignore */ }
        document.getElementById("f-name").value = "";
        document.getElementById("f-phone").value = "";
        document.getElementById("f-gps").value = "";
        document.getElementById("f-desc").value = "";
        showTicketSuccessCard();
    } catch (e) {
        console.error(e);
        showAlert(e.status === 429 ? e.message : "تعذر إرسال البلاغ، تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
    } finally {
        btn.disabled = false; btn.textContent = "📨 إرسال البلاغ لغرفة العمليات";
    }
}

export async function updateTicketStatus(id, status) {
    try {
        await apiPut(`/tickets/${id}/status`, { status });
        showToast("تم تحديث الحالة.");
    } catch (e) {
        showAlert("تعذر تحديث الحالة.");
    }
}

export function filterTicketsByStatus(status) {
    const select = document.getElementById("filter-ticket-status");
    if (select) select.value = status;
    renderTickets();
    document.getElementById("tickets-table-body")?.closest(".card-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateTicketsStatusSummary() {
    const newEl = document.getElementById("tickets-summary-new");
    const progress = document.getElementById("tickets-summary-progress");
    const done = document.getElementById("tickets-summary-done");
    const total = document.getElementById("tickets-summary-total");
    if (newEl) newEl.textContent = window.ticketsCache.filter(t => t.status === "جديد").length;
    if (progress) progress.textContent = window.ticketsCache.filter(t => t.status === "قيد المتابعة").length;
    if (done) done.textContent = window.ticketsCache.filter(t => t.status === "تم الحسم").length;
    if (total) total.textContent = window.ticketsCache.length;
}

// ============ عرض جدول البلاغات ============
export function renderTickets() {
    const search = (document.getElementById("filter-ticket-search")?.value || "").toLowerCase();
    const dir = document.getElementById("filter-ticket-directorate")?.value || "";
    const st = document.getElementById("filter-ticket-status")?.value || "";
    const tb = document.getElementById("tickets-table-body");
    if (!tb) return;
    if (!window._loaded.tickets) { tb.innerHTML = loadingRow(7); return; }
    let data = window.ticketsCache.filter(t => (!search || t.farmer_name?.toLowerCase().includes(search) || t.watercourse?.toLowerCase().includes(search)) && (!dir || t.directorate === dir) && (!st || t.status === st));
    if (data.length === 0) { tb.innerHTML = emptyRow(7, "لا توجد بلاغات مطابقة"); return; }
    tb.innerHTML = data.map(t => {
        let gpsHtml = t.gps ? `<span class="gps-badge"><a href="https://www.google.com/maps?q=${encodeURIComponent(t.gps)}" target="_blank" class="gps-link">📍 عرض</a></span>` : "-";
        let statusCell = isDataEditor()
            ? `<select onchange="updateTicketStatus('${t.id}', this.value)" style="padding:6px;border-radius:6px;font-weight:600;min-height:36px;background:var(--bg-card);color:var(--text-main);border:1px solid var(--border);">                <option value="جديد" ${t.status === "جديد" ? "selected" : ""}>جديد</option>
                <option value="قيد المتابعة" ${t.status === "قيد المتابعة" ? "selected" : ""}>قيد المتابعة</option>
                <option value="تم الحسم" ${t.status === "تم الحسم" ? "selected" : ""}>تم الحسم</option>
               </select>`
            : `<span class="badge ${t.status === "جديد" ? "blue" : t.status === "تم الحسم" ? "green" : "yellow"}">${escapeHtml(t.status) || "غير محدد"}</span>`;
        return `<tr>
            <td data-label="المُبلغ"><b>${escapeHtml(t.farmer_name)}</b></td>
            <td data-label="الهاتف">${escapeHtml(t.phone)}</td>
            <td data-label="الهندسة">${escapeHtml(t.directorate)}</td>
            <td data-label="المجرى">${escapeHtml(t.watercourse)}</td>
            <td data-label="نوع الشكوى">${escapeHtml(t.issue_type)}</td>
            <td data-label="الموقع">${gpsHtml}</td>
            <td data-label="الحالة">${statusCell}</td>
        </tr>`;
    }).join("");
}

function playNewTicketChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        osc.onended = () => ctx.close();
    } catch (e) { /* بعض المتصفحات تمنع الصوت قبل أي تفاعل من المستخدم — تجاهل بصمت */ }
}

// ============ التحديث الدوري (بديل onSnapshot)، فيه مقارنة يدوية
// لاكتشاف بلاغ "جديد" فعلياً وصل أثناء وجودنا في الصفحة (بديل
// docChanges().type === "added" من Firestore) ============
let stopPolling = null;
let knownIds = null; // null يعني "لسه أول تحميل"
export function initTicketsListener() {
    if (stopPolling) return;
    stopPolling = pollCollection('/tickets', (rows) => {
        window.ticketsCache = rows; // السيرفر بيرجّعها مرتبة created_at DESC بالفعل
        window._loaded.tickets = true;

        if (knownIds !== null) {
            const fresh = rows.filter(t => !knownIds.has(t.id));
            if (fresh.length > 0) {
                fresh.forEach(t => addNotification(`بلاغ جديد من "${t.farmer_name || "مزارع"}" على ${t.watercourse || "مجرى غير محدد"}`, "📩"));
                playNewTicketChime();
            }
        }
        knownIds = new Set(rows.map(t => t.id));

        renderTickets();
        updateTicketsStatusSummary();
    });
}
export function stopTicketsListener() {
    if (stopPolling) { stopPolling(); stopPolling = null; }
    window.ticketsCache = []; window._loaded.tickets = false; knownIds = null;
}
