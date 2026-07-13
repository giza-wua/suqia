// ══════════════════════════════════════════
//  سُقيا — Service Worker
//  بيخزّن "هيكل" التطبيق (HTML/CSS/JS/خطوط) عشان يفتح حتى بدون إنترنت.
//  البيانات نفسها (الترع/الكباري/الآبار) ليها نظام تخزين منفصل في IndexedDB
//  (شوف js/firebase-config.js) — الاتنين بيكملوا بعض: ده للواجهة، وده للبيانات.
// ══════════════════════════════════════════

const CACHE_NAME = "suqia-shell-v1.3.0";
const APP_SHELL = [
  "/index.html",
  "/manifest.json",
  "/css/style.css",
  "/css/01-tokens.css",
  "/css/02-base.css",
  "/css/03-layout.css",
  "/css/04-components.css",
  "/css/05-pages.css",
  "/js/firebase-config.js",
  "/js/shared.js",
  "/pages/dashboard.html",
  "/pages/canals.html",
  "/pages/bridges.html",
  "/pages/wells.html",
  "/pages/map.html",
  "/pages/settings.html",
  "/assets/icons/favicon.svg",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // نحاول نخزّن الكل، لكن لو حاجة فشلت (مثلاً خط مش موجود) منوقفش التثبيت كله
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // متلمسش طلبات خارجية (Firebase, CDN) — سيبها تتعامل عادي مع الشبكة/الكاش بتاعها هي
  if (url.origin !== self.location.origin) return;

  // ملفات HTML: جرّب الشبكة أولاً (عشان آخر تحديث)، ولو مفيش نت استخدم النسخة المخزّنة
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/index.html")))
    );
    return;
  }

  // باقي الملفات الثابتة (CSS/JS/خطوط/أيقونات): كاش أولاً، وحدّثه في الخلفية
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
