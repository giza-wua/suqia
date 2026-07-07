// ══════════════════════════════════════════
//  سُقيا v2.2 — shared.js  (UI helpers)
// ══════════════════════════════════════════

/* ── Theme ── */
const THEME_KEY = "suqia_theme";
export function getTheme() { try { return localStorage.getItem(THEME_KEY) || "light"; } catch { return "light"; } }
export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.innerHTML = theme === "dark"
      ? '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8l1.8-1.8M18 6l1.8-1.8"/></svg>'
      : '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>';
    btn.title = theme === "dark" ? "الوضع النهاري" : "الوضع الليلي";
  });
}
export function initTheme() { applyTheme(getTheme()); }
export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  applyTheme(next);
}

/* ── Topbar theme toggle (inline onclick بديل) ── */
export function wireThemeToggle() {
  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.addEventListener("click", toggleTheme);
  });
  applyTheme(getTheme());
}

/* ── Arabic date ── */
export function arabicDate(d = new Date()) {
  const days   = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── Greeting ── */
export function greeting(name) {
  const h = new Date().getHours();
  const g = h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور";
  return `${g}، ${name} 👋`;
}

/* ── Initials ── */
export function initials(name = "") {
  return name.trim().split(" ").slice(0, 2).map(w => w[0]).join("");
}

/* ── Render sidebar user ── */
export function renderSidebarUser(user) {
  const el = document.getElementById("sb-user-name");
  const rl = document.getElementById("sb-user-role");
  const av = document.getElementById("sb-avatar");
  if (el) el.textContent = user.name;
  if (rl) {
    rl.textContent = user.role === "admin" ? "مشرف" : "مستخدم";
    rl.className   = `sb-role ${user.role === "admin" ? "owner" : ""}`;
  }
  if (av) { av.textContent = initials(user.name); if (user.role === "admin") av.classList.add("owner"); }
}

/* ── Toast ── */
export function toast(msg, type = "info", ms = 3000) {
  let box = document.getElementById("toast-container");
  if (!box) { box = document.createElement("div"); box.id = "toast-container"; document.body.appendChild(box); }
  const icons = { success: "✓", error: "!", info: "ℹ" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span style="font-weight:900">${icons[type] || ""}</span><span>${msg}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(8px) scale(.95)"; }, ms - 280);
  setTimeout(() => t.remove(), ms);
}

/* ── Modal ── */
export function openModal(id) { document.getElementById(id)?.classList.add("open"); document.body.style.overflow = "hidden"; }
export function closeModal(id) { document.getElementById(id)?.classList.remove("open"); document.body.style.overflow = ""; }
export function setupModalClose(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(id); });
  overlay.querySelector(".modal-close")?.addEventListener("click", () => closeModal(id));
}

/* ── Sidebar (mobile) ── */
export function setupSidebar() {
  const sb      = document.getElementById("sidebar");
  const overlay = document.getElementById("sb-overlay");
  const mobBtn  = document.getElementById("mob-btn");
  if (!sb) return;
  mobBtn?.addEventListener("click", () => { sb.classList.toggle("open"); overlay?.classList.toggle("show"); });
  overlay?.addEventListener("click", () => { sb.classList.remove("open"); overlay.classList.remove("show"); });
}

/* ── Active nav link ── */
export function setActiveNav() {
  const page = location.pathname.split("/").pop();
  document.querySelectorAll(".nav-item").forEach(a => {
    const href = a.getAttribute("href")?.split("/").pop();
    if (href === page) a.classList.add("active");
  });
}

/* ── GPS button ── */
export function wireLocationButton(btnId, latId, lngId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.addEventListener("click", () => {
    if (!navigator.geolocation) { toast("المتصفح لا يدعم تحديد الموقع", "error"); return; }
    btn.disabled = true;
    btn.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> جاري…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById(latId).value = pos.coords.latitude.toFixed(6);
        document.getElementById(lngId).value = pos.coords.longitude.toFixed(6);
        toast("تم تحديد الموقع ✓", "success");
        btn.innerHTML = orig; btn.disabled = false;
      },
      (err) => {
        const msgs = { 1: "تم رفض إذن الوصول للموقع", 2: "تعذّر تحديد الموقع — تأكد من تفعيل GPS", 3: "انتهت المهلة، حاول تاني" };
        toast(msgs[err.code] || "تعذّر تحديد الموقع", "error");
        btn.innerHTML = orig; btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/* ── Google Maps link HTML ── */
export function mapsLinkHtml(row) {
  if (!row?.lat || !row?.lng) return "";
  return `<div class="detail-row"><span class="detail-key">📍 الموقع الجغرافي</span><span class="detail-val">
    <a href="https://www.google.com/maps?q=${row.lat},${row.lng}" target="_blank" rel="noopener" style="color:var(--teal);font-weight:800">فتح في خرائط جوجل ↗</a>
  </span></div>`;
}

/* ── Confirm delete ── */
export function confirmDelete(btn, onConfirm) {
  if (btn.dataset.confirming === "1") {
    onConfirm();
  } else {
    btn.dataset.confirming = "1";
    const orig = btn.innerHTML;
    btn.innerHTML = "⚠️ تأكيد الحذف";
    btn.classList.add("btn-danger"); btn.classList.remove("btn-secondary");
    setTimeout(() => {
      btn.dataset.confirming = "0"; btn.innerHTML = orig;
      btn.classList.remove("btn-danger"); btn.classList.add("btn-secondary");
    }, 3000);
  }
}

/* ── Export to Excel ── */
export async function exportToExcel({ title, subtitle, columns, rows, filename, recordCount }) {
  if (typeof ExcelJS === "undefined") { toast("مكتبة التصدير لم تُحمَّل", "error"); return; }
  const wb = new ExcelJS.Workbook();
  wb.creator = "سُقيا — منصة إدارة أصول ري الجيزة";
  wb.created = new Date();
  const cover = wb.addWorksheet("الغلاف", { views: [{ rightToLeft: true }] });
  cover.columns = [{ width: 4 }, { width: 60 }, { width: 4 }];
  cover.mergeCells("B2:B3");
  cover.getCell("B2").value = "💧 سُقيا"; cover.getCell("B2").font = { name: "Arial", size: 32, bold: true, color: { argb: "FF071226" } }; cover.getCell("B2").alignment = { horizontal: "center", vertical: "middle" };
  cover.getCell("B5").value = "منصة إدارة أصول ري الجيزة"; cover.getCell("B5").font = { name: "Arial", size: 14, color: { argb: "FF475569" } }; cover.getCell("B5").alignment = { horizontal: "center" };
  cover.mergeCells("B8:B9");
  cover.getCell("B8").value = title || "تقرير بيانات"; cover.getCell("B8").font = { name: "Arial", size: 22, bold: true, color: { argb: "FF0BB4AC" } }; cover.getCell("B8").alignment = { horizontal: "center", vertical: "middle" };
  if (subtitle) { cover.mergeCells("B11:B12"); cover.getCell("B11").value = subtitle; cover.getCell("B11").font = { name: "Arial", size: 13, color: { argb: "FF334155" } }; cover.getCell("B11").alignment = { horizontal: "center", vertical: "middle", wrapText: true }; }
  cover.getCell("B15").value = `📊 عدد السجلات: ${recordCount ?? rows.length}`; cover.getCell("B15").font = { name: "Arial", size: 13, bold: true }; cover.getCell("B15").alignment = { horizontal: "center" };
  cover.getCell("B17").value = `📅 تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}`; cover.getCell("B17").font = { name: "Arial", size: 11, color: { argb: "FF64748B" } }; cover.getCell("B17").alignment = { horizontal: "center" };
  for (let r = 1; r <= 20; r++) cover.getRow(r).height = r === 2 ? 30 : 20;
  const sheet = wb.addWorksheet("البيانات", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(c => ({ header: c.label, key: c.key, width: c.width || Math.max(14, c.label.length + 4) }));
  const hRow = sheet.getRow(1);
  hRow.eachCell(cell => { cell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF071226" } }; cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = { bottom: { style: "medium", color: { argb: "FF0BB4AC" } } }; });
  hRow.height = 26;
  rows.forEach((row, i) => {
    const r = sheet.addRow(columns.map(c => row[c.key] ?? ""));
    r.eachCell(cell => { cell.font = { name: "Arial", size: 12 }; cell.alignment = { horizontal: "right", vertical: "middle" }; cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } }; if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }; });
    r.height = 20;
  });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename || "تصدير.xlsx";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ── Cache status indicator ── */
export function showCacheStatus(isCached) {
  let el = document.getElementById("cache-status");
  if (!el) { el = document.createElement("div"); el.id = "cache-status"; document.body.appendChild(el); }
  el.style.transition = ".3s";
  if (isCached) { el.textContent = "⚡ من الذاكرة"; el.style.background = "#d1fae5"; el.style.color = "#065f46"; el.style.border = "1px solid #a7f3d0"; }
  else          { el.textContent = "🔥 من Firebase"; el.style.background = "#fef3c7"; el.style.color = "#92400e"; el.style.border = "1px solid #fde68a"; }
  setTimeout(() => { if (el) el.style.opacity = "0"; }, 2000);
  setTimeout(() => { if (el) { el.style.opacity = "1"; el.textContent = ""; } }, 2400);
}

/* ══════════════════════════════════════════
   DataList — بديل DataTable التقليدي
   يعرض كل سجل كـ card-row بدل صف جدول
══════════════════════════════════════════ */
export class DataList {
  constructor({ containerId, columns, data = [], onRowClick, pageSize = 25, emptyIcon = "📋", emptyText = "لا توجد بيانات", badgeColumn = null }) {
    this.containerId  = containerId;
    this.columns      = columns;       // [{key, label, searchable?, badge?}]
    this.allData      = data;
    this.filtered     = data;
    this.onRowClick   = onRowClick;
    this.pageSize     = pageSize;
    this.page         = 1;
    this.emptyIcon    = emptyIcon;
    this.emptyText    = emptyText;
    this.searchQuery  = "";
    this.searchKeys   = columns.filter(c => c.searchable).map(c => c.key);
    this.badgeColumn  = badgeColumn;   // key للعمود اللي يظهر كـ badge على اليمين
    this.extraFilterFn = null;
  }

  setData(data) { this.allData = data; this.page = 1; this._filter(); this.render(); }

  setExtraFilter(fn) { this.extraFilterFn = fn; this.page = 1; this._filter(); this.render(); }

  _filter() {
    const q = this.searchQuery.toLowerCase().trim();
    let base = this.extraFilterFn ? this.allData.filter(this.extraFilterFn) : this.allData;
    if (!q) { this.filtered = base; return; }
    this.filtered = base.filter(row => this.searchKeys.some(k => String(row[k] ?? "").toLowerCase().includes(q)));
  }

  _slice() { const s = (this.page - 1) * this.pageSize; return { slice: this.filtered.slice(s, s + this.pageSize), start: s }; }

  _totalPages() { return Math.max(1, Math.ceil(this.filtered.length / this.pageSize)); }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    const total = this.filtered.length;
    const tp    = this._totalPages();
    const { slice, start } = this._slice();

    // ── toolbar ──
    let html = `<div class="list-toolbar">
      <div class="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="search-input" id="ls-search-${this.containerId}" placeholder="بحث…" value="${this.searchQuery}" />
      </div>
    </div>`;

    // ── data rows ──
    html += `<div class="data-list">`;
    if (total === 0) {
      html += `<div class="empty"><div class="icon">${this.emptyIcon}</div><p>${this.emptyText}</p></div>`;
    } else {
      const titleCol   = this.columns[0];
      const metaCols   = this.columns.slice(1).filter(c => !c.badge);
      const badgeCol   = this.columns.find(c => c.badge) || null;
      slice.forEach((row, i) => {
        const delay = Math.min(i * 30, 180);
        const title = row[titleCol.key] || "—";
        const metaParts = metaCols.map(c => {
          const v = c.render ? c.renderText?.(row[c.key], row) : (row[c.key] || "");
          return v ? `<span>${c.label}: ${v}</span>` : "";
        }).filter(Boolean).join("");
        const badgeHtml = badgeCol
          ? (badgeCol.render ? badgeCol.render(row[badgeCol.key], row) : `<span class="badge badge-gray">${row[badgeCol.key] || ""}</span>`)
          : "";
        html += `<div class="data-row" data-id="${row.id}" style="animation-delay:${delay}ms">
          <div class="dr-num">${start + i + 1}</div>
          <div class="dr-main">
            <div class="dr-title">${title}</div>
            ${metaParts ? `<div class="dr-meta">${metaParts}</div>` : ""}
          </div>
          ${badgeHtml ? `<div class="dr-badge">${badgeHtml}</div>` : ""}
          <svg class="dr-chev ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </div>`;
      });
    }
    html += `</div>`;

    // ── pagination ──
    html += `<div class="pagination">
      <span class="pg-info">${total > 0 ? `${start + 1}–${Math.min(start + this.pageSize, total)} من ${total}` : "لا نتائج"}</span>
      <div class="pg-btns">
        <button class="pg-btn" id="pg-prev-${this.containerId}" ${this.page === 1 ? "disabled" : ""}>◄</button>`;
    for (let p = 1; p <= tp; p++) {
      if (tp <= 7 || p === 1 || p === tp || Math.abs(p - this.page) <= 1)
        html += `<button class="pg-btn ${p === this.page ? "active" : ""}" data-pg="${p}">${p}</button>`;
      else if (Math.abs(p - this.page) === 2)
        html += `<span style="padding:0 4px;color:var(--text-3);font-size:11px">…</span>`;
    }
    html += `<button class="pg-btn" id="pg-next-${this.containerId}" ${this.page === tp ? "disabled" : ""}>►</button>
      </div></div>`;

    container.innerHTML = html;

    // Events
    document.getElementById(`ls-search-${this.containerId}`)?.addEventListener("input", e => {
      this.searchQuery = e.target.value; this.page = 1; this._filter(); this.render();
    });
    document.getElementById(`pg-prev-${this.containerId}`)?.addEventListener("click", () => { if (this.page > 1) { this.page--; this.render(); } });
    document.getElementById(`pg-next-${this.containerId}`)?.addEventListener("click", () => { if (this.page < tp) { this.page++; this.render(); } });
    container.querySelectorAll("[data-pg]").forEach(btn => { btn.addEventListener("click", () => { this.page = parseInt(btn.dataset.pg); this.render(); }); });
    container.querySelectorAll(".data-row").forEach(row => {
      row.addEventListener("click", () => {
        const rec = this.filtered.find(r => r.id === row.dataset.id);
        if (rec && this.onRowClick) this.onRowClick(rec);
      });
    });
  }
}

// backward-compat alias
export { DataList as DataTable };
