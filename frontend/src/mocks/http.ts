import { HttpResponse } from "msw"

/**
 * Matches the API path whatever origin VITE_API_URL points at, so the same
 * handlers serve the dev server, Vitest and Playwright.
 */
export function apiPath(path: string) {
  return `*/api/v1${path}`
}

/** `{ success: true, data }`, the envelope for a single resource. */
export function ok<T>(data: T, init?: ResponseInit) {
  return HttpResponse.json({ success: true, data }, init)
}

/** `{ success: false, detail, errors?, code? }`, the envelope for every error. */
export function fail(
  status: number,
  detail: string,
  extra: { errors?: Record<string, string[]>; code?: string } = {}
) {
  return HttpResponse.json({ success: false, detail, ...extra }, { status })
}
