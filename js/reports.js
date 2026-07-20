// =====================================================================
// reports.js
// مؤشرات لوحة التحكم (KPIs) والرسوم البيانية (Chart.js) في تبويب
// "التقارير". يعتمد على مكتبة Chart.js المُحمّلة كـ <script> عادي في
// index.html.
// =====================================================================

export function updateKPIs() {
    document.getElementById("kpi-masaqi").textContent = window.masaqiCache.length;
    document.getElementById("kpi-critical").textContent = window.masaqiCache.filter(m => m.status === "تحتاج للتطهير").length;
    document.getElementById("kpi-members").textContent = window.membersCache.length;
    document.getElementById("kpi-tickets").textContent = window.ticketsCache.length;
    const kpiCriticalCanals = document.getElementById("kpi-critical-canals");
    if (kpiCriticalCanals) kpiCriticalCanals.textContent = window.canalTrackingCache.filter(c => c.status === "حرجة").length;
}

export function renderReports() {
    if (document.getElementById("admin-tab-reports")?.style.display === "none") return;
    Object.values(window.charts).forEach(c => { try { c.destroy(); } catch (e) { } });
    window.charts = {};

    const ctx1 = document.getElementById("chartMasaqiStatus")?.getContext("2d");
    if (ctx1) {
        const counts = { "تحتاج للتطهير": 0, "تم التطهير": 0, "قيد العمل": 0 };
        window.masaqiCache.forEach(m => { if (counts[m.status] !== undefined) counts[m.status]++; });
        window.charts.masaqiStatus = new Chart(ctx1, { type: "doughnut", data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ["#9C3B2C", "#2F7A56", "#D9A441"] }] }, options: { responsive: true, maintainAspectRatio: true } });
    }

    const ctx2 = document.getElementById("chartMasaqiDirectorate")?.getContext("2d");
    if (ctx2) {
        const dirCounts = {};
        window.masaqiCache.forEach(m => { const d = m.directorate || "غير محدد"; dirCounts[d] = (dirCounts[d] || 0) + 1; });
        const labels = Object.keys(dirCounts), data = Object.values(dirCounts);
        const colors = ["#0f4c46", "#1b6e64", "#2f7a56", "#b9692e", "#d9a441", "#1e5a7a", "#9c3b2c"];
        window.charts.masaqiDirectorate = new Chart(ctx2, { type: "bar", data: { labels, datasets: [{ label: "عدد المجاري", data, backgroundColor: labels.map((_, i) => colors[i % colors.length]) }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
    }

    const ctx3 = document.getElementById("chartTicketsStatus")?.getContext("2d");
    if (ctx3) {
        const ticketCounts = { "جديد": 0, "قيد المتابعة": 0, "تم الحسم": 0 };
        window.ticketsCache.forEach(t => { if (ticketCounts[t.status] !== undefined) ticketCounts[t.status]++; });
        window.charts.ticketsStatus = new Chart(ctx3, { type: "doughnut", data: { labels: Object.keys(ticketCounts), datasets: [{ data: Object.values(ticketCounts), backgroundColor: ["#1e5a7a", "#D9A441", "#2F7A56"] }] }, options: { responsive: true } });
    }

    const ctx4 = document.getElementById("chartMembersRole")?.getContext("2d");
    if (ctx4) {
        const roleCounts = {};
        window.membersCache.forEach(m => { const r = m.role || "غير محدد"; roleCounts[r] = (roleCounts[r] || 0) + 1; });
        const labels = Object.keys(roleCounts), data = Object.values(roleCounts);
        const colors2 = ["#0f4c46", "#b9692e", "#d9a441", "#1e5a7a", "#2f7a56", "#9c3b2c"];
        window.charts.membersRole = new Chart(ctx4, { type: "bar", data: { labels, datasets: [{ label: "عدد", data, backgroundColor: labels.map((_, i) => colors2[i % colors2.length]) }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
    }

    const ctx5 = document.getElementById("chartCanalStatus")?.getContext("2d");
    if (ctx5) {
        const canalCounts = { "حرجة": 0, "جاري التطهير": 0, "تم التطهير": 0, "لا تحتاج لتطهير": 0 };
        window.canalTrackingCache.forEach(c => { if (canalCounts[c.status] !== undefined) canalCounts[c.status]++; });
        window.charts.canalStatus = new Chart(ctx5, { type: "doughnut", data: { labels: Object.keys(canalCounts), datasets: [{ data: Object.values(canalCounts), backgroundColor: ["#9C3B2C", "#b47b00", "#2F7A56", "#1e5a7a"] }] }, options: { responsive: true, maintainAspectRatio: true } });
    }
}
