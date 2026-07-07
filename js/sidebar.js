// ══════════════════════════════════════════
//  سُقيا — sidebar.js
//  بناء الـ sidebar مرة واحدة وإدخاله في كل صفحة
// ══════════════════════════════════════════

const NAV_SVG = {
  dashboard: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9.5a1 1 0 0 0 1 1h3.5v-6h5v6H18a1 1 0 0 0 1-1V10"/></svg>`,
  specs:     `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 17 3l4 4L7 21z"/><path d="M12.5 7.5 16 11"/><path d="M9 11l3 3"/></svg>`,
  bridges:   `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18.5h20"/><path d="M4.5 18.5v-4a7.5 7.5 0 0 1 15 0v4"/><path d="M8 18.5v-3.5"/><path d="M16 18.5v-3.5"/></svg>`,
  canals:    `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5c2-2.7 4-2.7 6 0s4 2.7 6 0 4-2.7 6 0"/><path d="M2 15.5c2-2.7 4-2.7 6 0s4 2.7 6 0 4-2.7 6 0"/></svg>`,
  wells:     `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3"/></svg>`,
  settings:  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>`,
  logout:    `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  logo:      `<svg viewBox="0 0 24 24" fill="none" stroke="#0c1a33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3.4 4 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.6-7 6-11Z"/><path d="M9.2 14.2c.4 1.6 1.6 2.6 3.2 2.8"/></svg>`,
};

function navLink(href, icon, label, extraClass = "") {
  return `<a class="nav-item ${extraClass}" href="${href}">
    <span class="ni">${icon}</span>${label}
  </a>`;
}

export function buildSidebar(root = "../") {
  return `
<aside class="sidebar" id="sidebar">
  <div class="sb-brand">
    <div class="sb-logo">${NAV_SVG.logo}</div>
    <div class="sb-brand-text">
      <h2>سُقيا</h2>
      <span>إدارة أصول ري الجيزة</span>
      <span class="sb-version">v2.0</span>
    </div>
  </div>

  <nav class="sb-nav">
    <div class="sb-section">الرئيسية</div>
    ${navLink(root + "pages/dashboard.html", NAV_SVG.dashboard, "لوحة التحكم")}

    <div class="sb-section">البيانات الهندسية</div>
    ${navLink(root + "pages/specs.html",   NAV_SVG.specs,   "الأورنيك الهندسي")}
    ${navLink(root + "pages/bridges.html", NAV_SVG.bridges, "الكباري")}
    ${navLink(root + "pages/canals.html",  NAV_SVG.canals,  "الترع المبطنة")}
    ${navLink(root + "pages/wells.html",   NAV_SVG.wells,   "الآبار الجوفية")}

    <div class="sb-section admin-only" style="display:none">الإدارة</div>
    ${navLink(root + "pages/settings.html", NAV_SVG.settings, "الإعدادات", "admin-only").replace('style="display:none"', '').replace('<a ', '<a style="display:none" ')}
  </nav>

  <div class="sb-footer">
    <div class="sb-user">
      <div class="sb-avatar" id="sb-avatar">م</div>
      <div>
        <div class="sb-uname" id="sb-user-name">...</div>
        <span class="sb-role" id="sb-user-role">...</span>
      </div>
    </div>
    <button class="sb-logout" id="btn-logout">${NAV_SVG.logout} تسجيل الخروج</button>
  </div>
</aside>
<div id="sb-overlay"></div>`;
}

// يُستخدم مع buildSidebar لتصحيح الـ active nav حسب الصفحة الحالية
export function injectSidebar(root = "../") {
  const placeholder = document.getElementById("sidebar-placeholder");
  if (!placeholder) return;
  placeholder.outerHTML = buildSidebar(root);
}
