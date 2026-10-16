// OneDay Books offline service worker.
// Keeps the app opening when there is no signal. Pages are fetched fresh when
// online and fall back to the last seen version, or a friendly offline card,
// when offline. Static files are served from cache first for speed.

const CACHE = "oneday-books-v1";

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Offline</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0f1115;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}
  .card{max-width:320px}
  h1{font-size:20px;margin:0 0 8px}
  p{color:rgba(255,255,255,.6);font-size:14px;line-height:1.5}
</style></head>
<body><div class="card">
  <h1>You are offline</h1>
  <p>OneDay Books will reconnect on its own when you are back online. Anything
  you entered offline is saved and will sync.</p>
</div></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: network first, then cache, then the offline card.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (cached) =>
              cached ||
              new Response(OFFLINE_HTML, {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              }),
          ),
        ),
    );
    return;
  }

  // Static assets: cache first for speed.
  const cacheable =
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-touch-icon.png";

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res.ok && cacheable) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached),
    ),
  );
});
