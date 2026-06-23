/* Service worker: makes the app shell + card data available offline, and caches
 * card images on view. Two caches:
 *   rb-shell-<version> — app shell + cards.json (precached on install)
 *   rb-images-v1       — card art (cache-first; populated lazily and by "Download images")
 *
 * The shell cache is versioned by the build: the page registers this worker as
 * "sw.js?v=<APP_VERSION>", so every new build is a new SW URL that installs a
 * fresh shell cache and (on activate) deletes the old one. Image art is version
 * -independent, so it survives upgrades. No manual cache-name bumping needed.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL = `rb-shell-${VERSION}`;
const IMAGES = "rb-images-v1";
const SHELL_ASSETS = [
  "./", "./index.html", "./app.js", "./version.js", "./manifest.webmanifest",
  "./icon.svg", "./data/cards.json",
  "./fonts/chakra-petch-500.woff2", "./fonts/chakra-petch-700.woff2",
];
const IMG_HOST = "cmsassets.rgpub.io";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS))
  );
});

// The page posts "skipWaiting" when the user clicks Refresh on the update
// toast, so a freshly-installed worker takes over without waiting for all tabs
// to close. (On install we don't skipWaiting anymore — we wait for the prompt.)
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
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

  // Dev live-reload stream: never cache, let it pass straight through.
  if (url.pathname === "/__livereload") return;

  // App shell + data: network-first when online (keeps cards.json fresh),
  // falling back to cache when offline. Only handle same-origin GETs.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Clone synchronously, before the body is handed to the page —
          // caches.open() is async, so cloning inside its .then() would run
          // after the page has already consumed the body ("body already used").
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
  }
});
