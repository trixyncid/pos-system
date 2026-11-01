import { env } from "@/lib/env.ts"

/**
 * Register the app's service worker (public/sw.js) so the installed app
 * opens even when the internet blips. Skipped in development and in mock
 * mode, where the mock API's own worker owns the page.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || env.useMocks) return
  if (!("serviceWorker" in navigator)) return
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker could not register", error)
    })
  })
}

/**
 * The customer display installs as its own app (fullscreen, starting at
 * /display), so its page points the browser at its own manifest.
 */
export function pointToDisplayManifest() {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (link && link.getAttribute("href") !== "/display.webmanifest")
    link.setAttribute("href", "/display.webmanifest")
}
