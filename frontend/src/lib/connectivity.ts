import { create } from "zustand"

import { env } from "@/lib/env.ts"

/** While offline, the server is asked this often whether it is back. */
const PROBE_MS = 10_000

/**
 * Whether the server can be reached right now. Every API answer says yes;
 * a request that gets no answer (or only Caddy's "the API is down") says no.
 * The browser's own online/offline events are a hint: Wi-Fi up with the
 * internet down still counts as offline until the server answers.
 */
export const useConnectivity = create<{ online: boolean }>()(() => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
}))

let probing: number | null = null

/** /health/ at the API's own origin, which answers without signing in. */
function healthUrl() {
  return new URL("/health/", new URL(env.apiUrl, window.location.origin)).href
}

async function probe() {
  try {
    const response = await fetch(healthUrl(), { cache: "no-store" })
    if (response.ok) setOnline(true)
  } catch {
    // Still down; the next tick tries again.
  }
}

export function setOnline(online: boolean) {
  if (useConnectivity.getState().online !== online)
    useConnectivity.setState({ online })
  if (online && probing !== null) {
    window.clearInterval(probing)
    probing = null
  } else if (!online && probing === null) {
    probing = window.setInterval(() => void probe(), PROBE_MS)
  }
}

/** True for a failure that means "no connection", not "the server said no". */
export function isOfflineError(error: unknown) {
  if (typeof error !== "object" || error === null) return false
  const { response, code } = error as {
    response?: { status: number }
    code?: string
  }
  if (!response) return code !== "ERR_CANCELED"
  return [502, 503, 504].includes(response.status)
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => setOnline(false))
  window.addEventListener("online", () => void probe())
}
