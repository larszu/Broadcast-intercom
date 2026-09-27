// Offline shell for the browser beltpack (PWA).
//
// Only the app shell is cached: a beltpack without the core cannot talk, but
// it should still open from the home screen and say "offline" instead of the
// browser's error page, then reconnect by itself. State, audio and the API
// are never cached — a stale channel list on a beltpack is worse than none.
const SHELL = "intercom-shell-v1";
const SHELL_FILES = ["/", "/manifest.webmanifest", "/icons/beltpack-192.png", "/icons/beltpack-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname === "/ws") return;

  // Pages: network first, so a new build arrives at once; the cached shell
  // only when the core cannot be reached.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Vite's /assets/ carry a content hash in the name: cache first is safe.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
        return res;
      })),
    );
  }
});
