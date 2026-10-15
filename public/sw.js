/* Neuron Academy service worker (v1) — honest offline shell only.
 * - Cache-first for versioned static assets (_next/static) + public images.
 * - Network-first for navigations/API; offline navigations fall back to
 *   /offline. No app data is ever faked from cache: API responses are never
 *   served stale (network-only), so a cached page can only ever show the
 *   shell, never invented marks or attendance.
 */
const VERSION = "neuron-v1";
const STATIC_CACHE = `${VERSION}-static`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(["/offline", "/icon.svg"])).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Versioned static assets + images: cache-first.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/images/") || url.pathname === "/icon.svg") {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  // API: network-only, never stale.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, offline fallback page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline").then((r) => r || Response.error())));
  }
});
