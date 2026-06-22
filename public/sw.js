/* Service worker: makes the app shell + card data available offline, and caches
 * card images on view. Two caches:
 *   rb-shell-v1  — app shell + cards.json (precached on install)
 *   rb-images-v1 — card art (cache-first; populated lazily and by "Download images")
 */
const SHELL = "rb-shell-v2";
const IMAGES = "rb-images-v1";
const SHELL_ASSETS = [
  "./", "./index.html", "./app.js", "./manifest.webmanifest",
  "./icon.svg", "./data/cards.json",
];
const IMG_HOST = "cmsassets.rgpub.io";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL && k !== IMAGES).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Card images: cache-first (so they work offline once seen/downloaded).
  if (url.hostname === IMG_HOST) {
    e.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          // Image requests from <img> are opaque (no CORS); cache those too.
          if (res.ok || res.type === "opaque") cache.put(req, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // App shell + data: network-first when online (keeps cards.json fresh),
  // falling back to cache when offline. Only handle same-origin GETs.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
  }
});
