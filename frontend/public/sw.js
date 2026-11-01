/*
 * Yi Ci Pang POS service worker: makes the installed app open even when the
 * internet blips. It keeps the app itself (pages, scripts, styles, icons),
 * never the data: /api, /ws and /media always go to the server, so sales,
 * prices and stock are never stale.
 *
 * Built files have content hashes in their names, so they are cached for
 * good; the page itself is fetched fresh first and only falls back to the
 * cached copy when the network fails.
 */
const VERSION = "v1"
const SHELL = `yicipang-shell-${VERSION}`
const ASSETS = `yicipang-assets-${VERSION}`
const PRECACHE = ["/", "/display", "/manifest.webmanifest", "/display.webmanifest", "/favicon.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL && key !== ASSETS).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

function isData(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/") || url.pathname.startsWith("/media/")
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

  // Hashed build files, icons, fonts, photos shipped with the app: cache first.
  if (/^\/(assets|brand|icons|mock)\//.test(url.pathname) || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(
      caches.match(request).then(
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
