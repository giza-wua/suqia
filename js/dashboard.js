// =====================================================================
// js/dashboard.js — نفس المنطق بالظبط، فقط loadCollection بقت بتنادي
// apiGet بدل db.collection(name).get(). الحقول (updated_at) بقت نص
// datetime عادي من SQLite بدل Firestore Timestamp، فـ toDate() اتبسّطت.
// =====================================================================

import { apiGet } from "./services/api.js";
import { escapeHtml } from "./utils/ui-helpers.js";

const STALE_DAYS = 365;

function toDate(ts) {
    if (!ts) return null;
    const d = new Date(ts); // نص SQLite datetime ('YYYY-MM-DD HH:MM:SS') يتقرأ مباشرة
    return Number.isNaN(d.getTime()) ? null : d;
}

async function loadCollection(name) {
    try {
        return await apiGet(`/${name}`);
    } catch (e) {
        console.warn("dashboard load error:", name, e.message);
        return [];
    }
}

export function updateKPIs(data) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("kpi-masaqi", data.masaqi.length);
    set("kpi-critical-masaqi", data.masaqi.filter(m => m.status === "تحتاج للتطهير").length);
    set("kpi-canals", data.canals.length);
    set("kpi-critical-canals", data.canals.filter(c => c.status === "حرجة").length);
    set("kpi-tickets", data.tickets.length);
    set("kpi-tickets-new", data.tickets.filter(t => t.status === "جديد").length);
    set("kpi-members", data.members.length);
    set("kpi-bridges", data.bridges.length);
    set("kpi-wells", data.wells.length);
    set("kpi-drains", data.drains.length);
}

export function renderMaintenanceAlerts(data) {
    const box = document.getElementById("maintenance-alerts");
    if (!box) return;
    const now = Date.now();
    const groups = [
        { list: data.canals, label: "ترعة", page: "canals.html" },
        { list: data.bridges, label: "كبري", page: "bridges.html" },
        { list: data.wells, label: "بئر", page: "wells.html" },
        { list: data.drains, label: "مصرف", page: "drains.html" },
    ];
    const stale = [];
    groups.forEach(g => {
        g.list.forEach(r => {
            const updated = toDate(r.updated_at);
            if (!updated) return;
            const daysAgo = Math.floor((now - updated.getTime()) / 86400000);
            if (daysAgo >= STALE_DAYS) stale.push({ name: r.name, label: g.label, page: g.page, daysAgo });
        });
    });
    if (stale.length === 0) {
        box.innerHTML = `<div class="news-card-empty">✅ كل السجلات الهندسية محدَّثة خلال آخر سنة.</div>`;
        return;
    }
    stale.sort((a, b) => b.daysAgo - a.daysAgo);
    box.innerHTML = stale.slice(0, 20).map(s => `
        <div class="notif-item">
            <span class="notif-item-icon">⏰</span>
            <div class="notif-item-body">
                <div class="notif-item-text">${escapeHtml(s.name || "—")} <span style="color:var(--text-muted);font-weight:400;">(${s.label})</span></div>
                <div class="notif-item-time">آخر تحديث منذ ${s.daysAgo} يوم — <a href="${s.page}" style="color:var(--nile-light);font-weight:800;">مراجعة</a></div>
            </div>
        </div>
    `).join("");
}

export async function initDashboard() {
    const [masaqi, canals, tickets, members, bridges, wells, drains] = await Promise.all([
        loadCollection("masaqi"), loadCollection("canals"), loadCollection("tickets"),
        loadCollection("members"), loadCollection("bridges"), loadCollection("wells"), loadCollection("drains"),
    ]);
    const data = { masaqi, canals, tickets, members, bridges, wells, drains };
    updateKPIs(data);
    renderMaintenanceAlerts(data);
}
