// ══════════════════════════════════════════
//  سُقيا — shared.js  (UI helpers)
// ══════════════════════════════════════════

/* ── Toast ─────────────────────────────── */
export function toast(msg, type = "info", ms = 3000) {
  let box = document.getElementById("toast-container");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-container";
    document.body.appendChild(box);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ── Modal ─────────────────────────────── */
export function openModal(id) {
  document.getElementById(id)?.classList.add("open");
  document.body.style.overflow = "hidden";
}
export function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
  document.body.style.overflow = "";
}
export function setupModalClose(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeModal(id);
  });
  overlay.querySelector(".modal-close")?.addEventListener("click", () => closeModal(id));
}

/* ── Sidebar (mobile) ───────────────────── */
export function setupSidebar() {
  const sb      = document.getElementById("sidebar");
  const overlay = document.getElementById("sb-overlay");
  const mobBtn  = document.getElementById("mob-btn");
  if (!sb) return;

  mobBtn?.addEventListener("click", () => {
    sb.classList.toggle("open");
    overlay?.classList.toggle("show");
  });
  overlay?.addEventListener("click", () => {
    sb.classList.remove("open");
    overlay.classList.remove("show");
  });
}

/* ── Active nav link ────────────────────── */
export function setActiveNav() {
  const page = location.pathname.split("/").pop();
  document.querySelectorAll(".nav-item").forEach(a => {
    const href = a.getAttribute("href")?.split("/").pop();
    if (href === page) a.classList.add("active");
  });
}

/* ── Arabic date ────────────────────────── */
export function arabicDate() {
  const d = new Date();
  const days   = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── Greeting ───────────────────────────── */
export function greeting(name) {
  const h = new Date().getHours();
  const g = h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور";
  return `${g}، ${name} 👋`;
}

/* ── Initials ───────────────────────────── */
export function initials(name = "") {
  return name.trim().split(" ").slice(0, 2).map(w => w[0]).join("");
}

/* ── Render sidebar user info ───────────── */
export function renderSidebarUser(user) {
  const el = document.getElementById("sb-user-name");
  const rl = document.getElementById("sb-user-role");
  const av = document.getElementById("sb-avatar");
  if (el) el.textContent = user.name;
  if (rl) {
    rl.textContent = user.role === "admin" ? "👑 مشرف" : "👁️ مشاهد";
    rl.className   = `sb-role ${user.role}`;
  }
  if (av) av.textContent = initials(user.name);
}

/* ── DataTable ──────────────────────────── */
export class DataTable {
  constructor({ containerId, columns, data = [], onRowClick, pageSize = 20, emptyIcon = "📋", emptyText = "لا توجد بيانات" }) {
    this.containerId = containerId;
    this.columns     = columns;
    this.allData     = data;
    this.filtered    = data;
    this.onRowClick  = onRowClick;
    this.pageSize    = pageSize;
    this.page        = 1;
    this.emptyIcon   = emptyIcon;
    this.emptyText   = emptyText;
    this.searchQuery = "";
    this.searchKeys  = columns.filter(c => c.searchable).map(c => c.key);
  }

  setData(data) {
    this.allData  = data;
    this.page     = 1;
    this._filter();
    this.render();
  }

  _filter() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) { this.filtered = this.allData; return; }
    this.filtered = this.allData.filter(row =>
      this.searchKeys.some(k => String(row[k] ?? "").toLowerCase().includes(q))
    );
  }

  _slice() {
    const start = (this.page - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  _totalPages() {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const slice = this._slice();
    const total = this.filtered.length;
    const tp    = this._totalPages();
    const start = (this.page - 1) * this.pageSize;

    // Build table HTML
    let html = `
      <div class="card-header">
        <div class="search-bar">
          <input class="search-input" id="tbl-search-${this.containerId}" placeholder="🔍 بحث..." value="${this.searchQuery}" />
        </div>
      </div>
      <div class="tbl-wrap">`;

    if (total === 0) {
      html += `<div class="empty"><div class="icon">${this.emptyIcon}</div><p>${this.emptyText}</p></div>`;
    } else {
      html += `<table><thead><tr><th>#</th>`;
      this.columns.forEach(c => { html += `<th>${c.label}</th>`; });
      html += `<th></th></tr></thead><tbody>`;

      slice.forEach((row, i) => {
        html += `<tr data-id="${row.id}" style="cursor:pointer">`;
        html += `<td style="color:var(--text-3);font-size:11px">${start + i + 1}</td>`;
        this.columns.forEach(c => {
          const val = row[c.key] ?? "";
          html += `<td>${c.render ? c.render(val, row) : val || "—"}</td>`;
        });
        html += `<td style="color:var(--text-3)">◀</td></tr>`;
      });

      html += `</tbody></table>`;
    }

    html += `</div>
      <div class="pagination">
        <span class="pg-info">${total > 0 ? `عرض ${start + 1}–${Math.min(start + this.pageSize, total)} من ${total} سجل` : "لا توجد نتائج"}</span>
        <div class="pg-btns">
          <button class="pg-btn" id="pg-prev-${this.containerId}" ${this.page === 1 ? "disabled" : ""}>◄</button>`;

    for (let p = 1; p <= tp; p++) {
      if (tp <= 7 || p === 1 || p === tp || Math.abs(p - this.page) <= 1) {
        html += `<button class="pg-btn ${p === this.page ? "active" : ""}" data-pg="${p}">${p}</button>`;
      } else if (Math.abs(p - this.page) === 2) {
        html += `<span style="padding:0 4px;color:var(--text-3);font-size:11px">…</span>`;
      }
    }

    html += `<button class="pg-btn" id="pg-next-${this.containerId}" ${this.page === tp ? "disabled" : ""}>►</button>
        </div>
      </div>`;

    container.innerHTML = html;

    // Events
    document.getElementById(`tbl-search-${this.containerId}`)?.addEventListener("input", e => {
      this.searchQuery = e.target.value;
      this.page = 1;
      this._filter();
      this.render();
    });

    document.getElementById(`pg-prev-${this.containerId}`)?.addEventListener("click", () => {
      if (this.page > 1) { this.page--; this.render(); }
    });

    document.getElementById(`pg-next-${this.containerId}`)?.addEventListener("click", () => {
      if (this.page < tp) { this.page++; this.render(); }
    });

    container.querySelectorAll("[data-pg]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.page = parseInt(btn.dataset.pg);
        this.render();
      });
    });

    container.querySelectorAll("tbody tr").forEach(tr => {
      tr.addEventListener("click", () => {
        const row = this.filtered.find(r => r.id === tr.dataset.id);
        if (row && this.onRowClick) this.onRowClick(row);
      });
    });
  }
}

/* ── Confirm delete helper ──────────────── */
export function confirmDelete(btn, onConfirm) {
  if (btn.dataset.confirming === "1") {
    onConfirm();
  } else {
    btn.dataset.confirming = "1";
    const orig = btn.textContent;
    btn.textContent = "⚠️ تأكيد الحذف";
    btn.classList.add("btn-danger");
    btn.classList.remove("btn-secondary");
    setTimeout(() => {
      btn.dataset.confirming = "0";
      btn.textContent = orig;
      btn.classList.remove("btn-danger");
      btn.classList.add("btn-secondary");
    }, 3000);
  }
}

/* ── Cache indicator ──────────────────── */
export function showCacheStatus(isCached) {
  let el = document.getElementById('cache-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cache-status';
    el.style.cssText = 'position:fixed;bottom:16px;right:16px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;z-index:999;transition:.3s;font-family:Cairo,sans-serif;';
    document.body.appendChild(el);
  }
  if (isCached) {
    el.textContent = '⚡ من الذاكرة المؤقتة';
    el.style.background = '#d1fae5';
    el.style.color = '#065f46';
    el.style.border = '1px solid #a7f3d0';
  } else {
    el.textContent = '🔥 من Firebase';
    el.style.background = '#fef3c7';
    el.style.color = '#92400e';
    el.style.border = '1px solid #fde68a';
  }
  setTimeout(() => { if (el) el.style.opacity = '0'; }, 2000);
  setTimeout(() => { if (el) el.style.opacity = '1'; el.textContent = ''; }, 2300);
}
