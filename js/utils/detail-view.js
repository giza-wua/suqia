// =====================================================================
// js/utils/detail-view.js — كرت عرض تفاصيل موحَّد (مُستوحى من تصميم
// سُقيا القديم قبل الدمج) يُستخدم في كل شاشات المنشآت (الترع، الكباري،
// الآبار، المصارف، المساقي). بيبني عنصر ديالوج واحد بس ويحقنه في
// الصفحة أول مرة، وبعدين أي صفحة تقدر تفتحه بمحتوى مختلف — بدل ما كل
// صفحة تكرر نفس الـHTML/CSS الخاص بالمودال.
//
// بيعيد استخدام كلاسات .form-dialog-overlay / .form-dialog الموجودة
// بالفعل (نفس شكل ديالوج الإضافة/التعديل، بما فيها سلوك bottom-sheet
// على الموبايل) عشان الشكل يفضل متّسق مع باقي التطبيق.
// =====================================================================

import { escapeHtml } from "./ui-helpers.js";
import { icon } from "../icons.js";

let injected = false;

function ensureDialog() {
    if (injected) return;
    injected = true;
    const el = document.createElement("div");
    el.className = "form-dialog-overlay";
    el.id = "detail-dialog-overlay";
    el.innerHTML = `
        <div class="form-dialog form-dialog-lg">
            <div class="form-dialog-head">
                <h3 id="detail-dialog-title"></h3>
                <button class="form-dialog-close" id="detail-dialog-close" type="button"></button>
            </div>
            <div class="form-dialog-body" id="detail-dialog-body"></div>
        </div>`;
    document.body.appendChild(el);
    document.getElementById("detail-dialog-close").innerHTML = icon("close", 18);
    document.getElementById("detail-dialog-close").addEventListener("click", closeDetail);
    el.addEventListener("click", (e) => { if (e.target === el) closeDetail(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
}

export function openDetail(titleHtml, bodyHtml) {
    ensureDialog();
    document.getElementById("detail-dialog-title").innerHTML = titleHtml;
    document.getElementById("detail-dialog-body").innerHTML = bodyHtml;
    document.getElementById("detail-dialog-overlay").classList.add("open");
}

export function closeDetail() {
    document.getElementById("detail-dialog-overlay")?.classList.remove("open");
}

// ============ عناصر بناء المحتوى ============

// شبكة "مفتاح/قيمة" — items: [{label, value?, html?}]
// لو value فاضية أو undefined بتتحول تلقائي لـ "—" بدل ما تفضل فاضية
// أو تظهر "null"/"undefined" حرفي (نفس فئة الباج اللي ظهر في جدول الترع).
export function specGrid(items) {
    return `<div class="spec-detail-grid">${items.map(it => `
        <div class="spec-kv">
            <div class="sk">${escapeHtml(it.label)}</div>
            <div class="sv">${it.html ?? (escapeHtml(it.value) || "—")}</div>
        </div>`).join("")}</div>`;
}

export function mapsLink(lat, lng) {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (!lat || !lng || Number.isNaN(la) || Number.isNaN(ln)) return "";
    return `<div style="margin-top:16px;text-align:center;padding-top:14px;border-top:1px solid var(--border-light)">
        <a href="https://www.google.com/maps?q=${la},${ln}" target="_blank" rel="noopener"
           style="color:var(--info);font-weight:800;text-decoration:none;font-size:0.85rem;">📍 فتح الموقع في خرائط جوجل ↗</a>
    </div>`;
}

export function notesBlock(notes) {
    if (!notes || !String(notes).trim()) return "";
    return `<div style="margin-top:14px;background:var(--bg-subtle);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:12px 14px;">
        <div class="sk" style="margin-bottom:4px;">ملاحظات</div>
        <div style="font-size:0.85rem;line-height:1.7;white-space:pre-line;">${escapeHtml(notes)}</div>
    </div>`;
}
