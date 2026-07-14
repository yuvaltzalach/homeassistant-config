// sw.js — Service Worker לאופליין. cache-first על ה-app shell.
const CACHE = "budget-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/model.js",
  "./js/store.js",
  "./js/charts.js",
  "./js/drive.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // בקשות ל-Google (סנכרון) — תמיד מהרשת, לא לשמור במטמון.
  if (url.hostname.includes("google")) return;
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          // שמירה במטמון של אותה סביבה (same-origin) בלבד
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
