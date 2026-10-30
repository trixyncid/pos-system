/**
 * The access token lives in memory only. The refresh token is an httpOnly
 * cookie the API sets, which scripts cannot read; this hint just remembers
 * that a session exists, so a tablet that never signed in skips the refresh
 * call on startup.
 */
const hintKey = "pos.session"

let accessToken: string | null = null

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getAccessToken() {
  return accessToken
}

export function hasSessionHint() {
  return storage()?.getItem(hintKey) === "1"
}

export function setSession(access: string) {
  accessToken = access
  storage()?.setItem(hintKey, "1")
}

export function clearSession() {
  accessToken = null
  storage()?.removeItem(hintKey)
}

/**
 * Calls back when another tab signs in or out (the hint appears or goes).
 * The browser fires this only in the other tabs, never the one that changed it.
 */
export function watchSessionHint(onChange: (signedIn: boolean) => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === hintKey || event.key === null) onChange(hasSessionHint())
  }
  window.addEventListener("storage", handler)
  return () => window.removeEventListener("storage", handler)
}
