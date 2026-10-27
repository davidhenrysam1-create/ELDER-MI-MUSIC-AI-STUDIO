/*
 * Elder Mi Music AI Studio service worker.
 *
 * Deliberately conservative: the app shell and icons are cached so the studio
 * opens (and shows its offline page) without a connection, while API routes and
 * audio streams are never cached — those need the real server, and caching
 * private audio in the browser cache would be both stale and privacy-unfriendly.
 */

const VERSION = "eldermi-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_URLS = ["/", "/vocal", "/mix", "/mastering", "/projects", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isCacheableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      /\.(png|svg|ico|webp|woff2?)$/.test(url.pathname))
  );
}

function isPrivateData(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/audio") ||
    url.pathname.endsWith(".wav") ||
    url.pathname.endsWith(".mp3")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API responses or audio: they must always be fresh and private.
  if (isPrivateData(url)) return;

  // Static build output and icons: cache-first, refreshed in the background.
  if (isCacheableAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone()).catch(() => undefined);
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
    return;
  }

  // Page navigations: network-first, falling back to the cached page, then the
  // offline screen. This keeps the studio usable on a flaky mobile connection.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = (await cache.match(request)) || (await cache.match("/"));
          return cached || (await cache.match("/offline")) || Response.error();
        }
      })(),
    );
  }
});

// Allow the page to ask the waiting worker to take over after an update.
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
