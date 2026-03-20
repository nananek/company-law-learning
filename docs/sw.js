const CACHE_NAME = "company-law-v1";

const PRECACHE = [
  "./",
  "css/style.css",
  "js/app.js",
  "js/map.js",
  "js/topics.js",
  "js/article-panel.js",
  "js/search.js",
  "lib/fuse.min.js",
  "data/hierarchy.json",
  "data/topics.json",
  "data/search-index.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      // Network-first for article data (may update), cache-first for everything else
      if (cached && !e.request.url.includes("/data/articles/")) {
        return cached;
      }
      return fetch(e.request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => cached || new Response("オフライン", { status: 503 }));
    })
  );
});
