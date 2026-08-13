// =====================================================================
// sw.js — منصة زمام الجيزة
// يخزّن هيكل الواجهة العامة (index.html وملفاته) محلياً على الجهاز، حتى
// تفتح شاشة البلاغات على الأقل عند انقطاع مؤقت في الاتصال بالميدان.
// نفس مبدأ Service Worker في زمام الأصلية (منذ 1.7.0 هناك).
//
// عند أي رفع مستقبلي فيه تغيير حقيقي بالملفات، غيّر CACHE_NAME هنا حتى
// يُجبَر المتصفح على تحميل النسخة الجديدة بدل الاعتماد على القديمة.
// =====================================================================

const CACHE_NAME = "zimam-unified-shell-v1.2.2";

const APP_SHELL_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/01-tokens.css",
    "./css/02-components.css",
    "./css/03-app-components.css",
    "./css/04-public-layout.css",
    "./css/05-responsive.css",
    "./js/version.js",
    "./js/icons.js",
    "./js/services/api.js",
    "./js/auth.js",
    "./js/shared.js",
    "./js/data/masaqi.js",
    "./js/data/canals.js",
    "./js/data/canal-names-reference.js",
    "./js/data/tickets.js",
    "./js/data/news.js",
    "./js/utils/ui-helpers.js",
    "./js/utils/gps.js",
    "./js/utils/identity.js",
    "./js/utils/modal.js",
    "./js/utils/toast.js",
    "./js/utils/notifications.js",
    "./js/utils/week-filter.js",
    "./js/utils/activity-log.js",
    "./assets/branding/amana-logo.png",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(req)
            .then((networkResponse) => {
                const copy = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
                return networkResponse;
            })
            .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
});
