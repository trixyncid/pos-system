/*
 * Yi Ci Pang POS service worker: makes the installed app open even when the
 * internet is down. It keeps the app itself (pages, scripts, styles, icons)
 * and the product photos, never the data: /api and /ws always go to the
 * server. (The snack bar's own offline copy of the products lives in
 * src/lib/offline-cache.ts.)
 *
 * Built files have content hashes in their names, so they are cached for
 * good; the page itself is fetched fresh first and only falls back to the
 * cached copy when the network fails. Every build lists all its files in
 * BUILD_ASSETS (vite.config.ts writes it), so one visit online caches every
 * screen, including the ones opened only during an outage; that list also
 * changes this file, which installs the new version.
 */
const VERSION = "v2"
const SHELL = `yicipang-shell-${VERSION}`
const ASSETS = `yicipang-assets-${VERSION}`
const PHOTOS = "yicipang-photos"
const PRECACHE = ["/", "/display", "/manifest.webmanifest", "/display.webmanifest", "/favicon.png"]
const BUILD_ASSETS = [] // Filled in by the build.

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)),
      caches.open(ASSETS).then((cache) => cache.addAll(BUILD_ASSETS)),
    ])
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  const current = new Set(BUILD_ASSETS.map((path) => new URL(path, self.location.origin).href))
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL && key !== ASSETS && key !== PHOTOS).map((key) => caches.delete(key)))
      )
      // Drop the previous builds' files.
      .then(() => caches.open(ASSETS))
      .then((cache) =>
        cache
          .keys()
          .then((requests) =>
            Promise.all(
              requests
                .filter((request) => new URL(request.url).pathname.startsWith("/assets/") && !current.has(request.url))
                .map((request) => cache.delete(request))
            )
          )
      )
      .then(() => self.clients.claim())
  )
})

function isData(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/") || url.pathname.startsWith("/health/")
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || isData(url)) return

  // Pages: the network first, the cached app when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL).then((cache) => cache.put(url.pathname === "/display" ? "/display" : "/", copy))
          return response
        })
        .catch(() =>
          caches.match(url.pathname.startsWith("/display") ? "/display" : "/").then((hit) => hit || caches.match("/"))
        )
    )
    return
  }

  // Uploaded product photos: the saved copy at once (so the snack bar shows
  // them offline), refreshed from the server in the background.
  if (url.pathname.startsWith("/media/")) {
    event.respondWith(
      caches.open(PHOTOS).then((cache) =>
        cache.match(request, { ignoreVary: true }).then((hit) => {
          const fresh = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone())
              return response
            })
            .catch(() => hit || Response.error())
          return hit || fresh
        })
      )
    )
    return
  }

  // Hashed build files, icons, fonts, photos shipped with the app: cache first.
  // ignoreVary: a file cached up front (no Origin header) must still match the
  // browser's module request (with one) when the server sends "Vary: Origin".
  if (/^\/(assets|brand|icons|mock)\//.test(url.pathname) || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(ASSETS).then((cache) => cache.put(request, copy))
            }
            return response
          })
      )
    )
  }
})
