import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"

import { env } from "@/lib/env.ts"
import { clearSession, getAccessToken, setSession } from "@/lib/session.ts"

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let sessionDead = false
let refreshing: Promise<string> | null = null
let onUnauthorized: (() => void) | null = null

// PIN unlock is not here: it needs the tablet's session, so an expired token there is refreshed like any call.
const publicAuthPaths = ["/auth/login/", "/auth/logout/"]

/** Most calls answer well within a second; a hung connection should fail instead of spinning forever. */
const TIMEOUT_MS = 20_000
/** Uploads carry an image and may run on a slow restaurant Wi-Fi. */
const UPLOAD_TIMEOUT_MS = 90_000

// X-Session-Cookie asks the API to keep the refresh token in an httpOnly
// cookie; withCredentials lets the browser store and send that cookie.
const clientConfig = {
  baseURL: env.apiUrl,
  headers: { "Content-Type": "application/json", "X-Session-Cookie": "1" },
  timeout: TIMEOUT_MS,
  withCredentials: true,
}

export const api = axios.create(clientConfig)

const refreshClient = axios.create(clientConfig)

export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler
}

export function resetSessionState() {
  sessionDead = false
  refreshing = null
}

export function markSessionExpired() {
  sessionDead = true
  refreshing = null
}

async function requestRefresh() {
  const { data } = await refreshClient.post<{ access: string }>(
    "/auth/refresh/",
    {}
  )
  setSession(data.access)
  return data.access
}

/**
 * A new access token from the refresh cookie. Each refresh replaces the
 * cookie and retires the old one, so tabs take turns: a tab that waited sends
 * the cookie the previous tab just received.
 */
export function refreshSession() {
  refreshing ??= (
    navigator.locks
      ? navigator.locks.request("pos-refresh", requestRefresh)
      : requestRefresh()
  ).finally(() => {
    refreshing = null
  })
  return refreshing
}

/** True only when the API says the session is over. A network error, timeout or busy server is not. */
export function isSessionEnded(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401
}

function isPublicAuth(url: string | undefined) {
  if (!url) return false
  const path = url.split("?", 1)[0] ?? ""
  return publicAuthPaths.some((publicPath) => path.endsWith(publicPath))
}

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData && config.timeout === TIMEOUT_MS)
    config.timeout = UPLOAD_TIMEOUT_MS
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }
    if (
      sessionDead ||
      isPublicAuth(original.url) ||
      original.url?.includes("/auth/refresh/")
    ) {
      return Promise.reject(error)
    }

    original._retry = true
    try {
      const access = await refreshSession()
      original.headers.Authorization = `Bearer ${access}`
      return api(original)
    } catch (refreshError) {
      // Offline or a server hiccup: keep the session and let the caller retry later.
      if (!isSessionEnded(refreshError)) return Promise.reject(refreshError)
      clearSession()
      markSessionExpired()
      onUnauthorized?.()
      return Promise.reject(refreshError)
    }
  }
)
