// =====================================================================
// data/news.js — نفس المنطق بالظبط. date_string/timestamp بقوا مُدارين
// من السيرفر (news.js في الـ Worker) بدل الكلاينت.
// =====================================================================

import { apiPost, apiPut, apiDelete, pollCollection } from '../services/api.js';
import { showAlert, showConfirm } from '../utils/modal.js';
import { showToast } from '../utils/toast.js';
import { isDataEditor } from '../auth.js';
import { loadingRow, emptyRow, escapeHtml } from '../utils/ui-helpers.js';

// ============ الأخبار ============
export async function saveNews() {
    const id = document.getElementById("news-id").value;
    const title = document.getElementById("news-title").value.trim();
    const body = document.getElementById("news-body").value.trim();
    const type = document.getElementById("news-type").value;
    if (!title || !body) { showAlert("الرجاء إدخال عنوان ونص الخبر."); return; }
    const data = { title, body, type };
    try {
        if (id) await apiPut(`/news/${id}`, data);
        else await apiPost('/news', data);
        showToast(id ? "✅ تم تحديث الخبر." : "📢 تم نشر الخبر!");
        cancelEditNews();
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر حفظ الخبر، حاول مرة أخرى.");
    }
}

export function editNewsTrigger(id) {
    if (!isDataEditor()) return;
    const n = window.newsCache.find(x => x.id === id);
    if (!n) return;
    document.getElementById("news-id").value = n.id;
    document.getElementById("news-title").value = n.title || "";
    document.getElementById("news-body").value = n.body || "";
    document.getElementById("news-type").value = n.type || "عام";
    document.getElementById("btn-save-news").textContent = "🔄 تحديث الخبر";
    document.getElementById("btn-cancel-edit-news").style.display = "inline-block";
    document.getElementById("dialog-title").textContent = "تعديل الخبر";
    document.getElementById("form-dialog-overlay").classList.add("open");
}

export function cancelEditNews() {
    document.getElementById("news-id").value = "";
    document.getElementById("news-title").value = "";
    document.getElementById("news-body").value = "";
    document.getElementById("news-type").value = "عام";
    document.getElementById("btn-save-news").textContent = "نشر الخبر";
    document.getElementById("btn-cancel-edit-news").style.display = "none";
    document.getElementById("form-dialog-overlay")?.classList.remove("open");
}

export async function deleteNews(id) {
    const ok = await showConfirm("هل تريد حذف هذا الخبر؟");
    if (!ok) return;
    try {
        await apiDelete(`/news/${id}`);
        showToast("🗑️ تم حذف الخبر.");
    } catch (e) {
        showAlert(e.friendly ? e.message : "تعذر الحذف، حاول مرة أخرى.");
    }
}

// ============ عرض كروت الأخبار (الواجهة الرئيسية) ============
export function renderNewsCards() {
    const container = document.getElementById("news-cards");
    if (!container) return;
    if (!window._loaded.news) { container.innerHTML = '<div class="news-card-empty">⏳ جاري تحميل الأخبار...</div>'; return; }
    const latest = window.newsCache.slice(0, 3);
    if (latest.length === 0) {
        container.innerHTML = '<div class="news-card-empty">لا توجد أخبار حالياً</div>';
        return;
    }
    container.innerHTML = latest.map(n => {
        let accent = "accent-general", badgeClass = "blue", badgeText = "عام";
        if (n.type === "عاجل") { accent = "accent-urgent"; badgeClass = "red"; badgeText = "🔴 عاجل"; }
        else if (n.type === "توعية") { accent = "accent-awareness"; badgeClass = "green"; badgeText = "🟢 توعية"; }
        else { badgeText = "🔵 عام"; }
        return `<div class="news-card ${accent}">
            <span class="news-card-badge ${badgeClass}">${badgeText}</span>
            <h4>${escapeHtml(n.title)}</h4>
            <p>${escapeHtml(n.body)}</p>
            <span class="news-card-date">${escapeHtml(n.date_string) || ""}</span>
        </div>`;
    }).join("");
    if (latest.length < 3) {
        for (let i = latest.length; i < 3; i++) container.innerHTML += '<div class="news-card-empty">خبر قادم قريباً</div>';
    }
}

// ============ عرض جدول الأخبار (لوحة الإدارة) ============
let newsTypeFilter = "";
export function filterNewsByType(type) {
    newsTypeFilter = type;
    renderNewsTable();
    document.getElementById("news-table")?.closest(".card-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderNewsTable() {
    const tb = document.getElementById("news-table-body");
    if (!tb) return;
    if (!window._loaded.news) { tb.innerHTML = loadingRow(5); return; }
    const data = newsTypeFilter ? window.newsCache.filter(n => n.type === newsTypeFilter) : window.newsCache;
    if (data.length === 0) { tb.innerHTML = emptyRow(5, "لا توجد أخبار مطابقة"); return; }
    tb.innerHTML = data.map(n => {
        const actions = isDataEditor()
            ? `<button class="btn-icon" onclick="editNewsTrigger('${n.id}')">✏️ تعديل</button> <button class="btn-icon" style="color:var(--danger)" onclick="deleteNews('${n.id}')">🗑️ حذف</button>`
            : `<span style="color:var(--text-muted);font-size:0.7rem;">👁️ عرض فقط</span>`;
        return `<tr>
            <td data-label="العنوان"><b>${escapeHtml(n.title)}</b></td>
            <td data-label="النوع"><span class="badge ${n.type === "عاجل" ? "red" : n.type === "توعية" ? "green" : "blue"}">${escapeHtml(n.type)}</span></td>
            <td data-label="النص">${escapeHtml(n.body)}</td>
            <td data-label="التاريخ">${escapeHtml(n.date_string) || ""}</td>
            <td data-label="إجراء">${actions}</td>
        </tr>`;
    }).join("");
}

function updateNewsSummary() {
    const urgent = document.getElementById("news-summary-urgent");
    const awareness = document.getElementById("news-summary-awareness");
    const general = document.getElementById("news-summary-general");
    const total = document.getElementById("news-summary-total");
    if (urgent) urgent.textContent = window.newsCache.filter(n => n.type === "عاجل").length;
    if (awareness) awareness.textContent = window.newsCache.filter(n => n.type === "توعية").length;
    if (general) general.textContent = window.newsCache.filter(n => n.type === "عام").length;
    if (total) total.textContent = window.newsCache.length;
}

// ============ التحديث الدوري (بديل onSnapshot) ============
export function initNewsListener() {
    pollCollection('/news', (rows) => {
        window.newsCache = rows; // السيرفر بيرجّعها بالفعل مرتبة created_at DESC
        window._loaded.news = true;
        renderNewsCards(); renderNewsTable(); updateNewsSummary();
    });
}
