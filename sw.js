// ══════════════════════════════════════════
//  سُقيا — Service Worker
//  يُخزِّن هيكل التطبيق (HTML/CSS/JS/الخطوط) حتى يفتح ولو من دون اتصال بالإنترنت.
//  للبيانات نفسها (الترع والكباري والآبار) نظام تخزين منفصل عبر IndexedDB
//  (يُراجَع js/firebase-config.js) — يكمِّل كل نظام الآخر: هذا للواجهة، وذاك للبيانات.
// ══════════════════════════════════════════

const CACHE_NAME = "suqia-shell-v1.4.1";
// ⚠️ مسارات نسبية إلى موضع ملف sw.js نفسه (وليس إلى جذر الدومين)، حتى يعمل التطبيق
// بشكل صحيح سواء نُشر على جذر الدومين أو داخل مجلد فرعي (subpath).
const SW_SCOPE = self.registration.scope; // مسار كامل لمجلد الـ scope (بينتهي بـ /)
const APP_SHELL = [
  "index.html",
  "manifest.json",
  "css/style.css",
  "css/01-tokens.css",
  "css/02-base.css",
  "css/03-layout.css",
  "css/04-components.css",
  "css/05-pages.css",
  "js/firebase-config.js",
  "js/shared.js",
  "pages/dashboard.html",
  "pages/canals.html",
  "pages/bridges.html",
  "pages/wells.html",
  "pages/drains.html",
  "pages/map.html",
  "pages/settings.html",
  "assets/icons/favicon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
].map((p) => new URL(p, SW_SCOPE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // تُخزَّن جميع الملفات قدر الإمكان، ولا يُوقَف التثبيت كله إذا فشل تخزين أحدها (كخط غير موجود مثلاً)
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
  // لا تُلمَس الطلبات الخارجية (Firebase، وشبكات توصيل المحتوى) — تُترَك لتتعامل مع الشبكة أو التخزين المؤقت الخاص بها
  if (url.origin !== self.location.origin) return;

  // ملفات HTML: تُجرَّب الشبكة أولاً (لضمان الحصول على آخر تحديث)، وإذا انعدم الاتصال تُستخدَم النسخة المخزَّنة
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match(new URL("index.html", SW_SCOPE).href)))
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
