import { delay, http, HttpResponse } from "msw"

import { roleName, staff, toUser } from "@/mocks/db/staff.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

/**
 * Stands in for the httpOnly refresh cookie. Kept in localStorage so a page
 * reload keeps the tablet signed in, as the real cookie would.
 */
const sessionKey = "pos.mock.session"
const pinAttempts = new Map<number, { failed: number; lockedUntil: number }>()
const PIN_MAX_ATTEMPTS = 5
const PIN_LOCK_MS = 15 * 60_000

function sessionUserId(): number | null {
  try {
    const raw = window.localStorage.getItem(sessionKey)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function setSessionUser(id: number | null) {
  try {
    if (id === null) window.localStorage.removeItem(sessionKey)
    else window.localStorage.setItem(sessionKey, String(id))
  } catch {
    // Storage blocked: the mock session lasts for this page.
  }
}

function issue(id: number) {
  setSessionUser(id)
  return `mock.${id}.${Date.now()}`
}

/** The staff member an `Authorization: Bearer mock.<id>.<n>` header belongs to. */
export function bearerStaff(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "")
  const id = Number(token?.split(".")[1])
  return staff.find((member) => member.id === id)
}

function unauthenticated() {
  return fail(401, "Authentication credentials were not provided.", {
    code: "not_authenticated",
  })
}

export const authHandlers = [
  http.post(apiPath("/auth/login/"), async ({ request }) => {
    await delay()
    const body = (await request.json()) as { email?: string; password?: string }
    const member = staff.find(
      (item) =>
        item.email === body.email?.trim().toLowerCase() &&
        item.password === body.password
    )
    if (!member)
      return fail(401, "Email or password is incorrect.", {
        code: "invalid_credentials",
      })
    return HttpResponse.json({
      success: true,
      access: issue(member.id),
      expires_in: 900,
      user: toUser(member),
    })
  }),

  http.post(apiPath("/auth/refresh/"), async () => {
    await delay()
    const id = sessionUserId()
    if (!id || !staff.some((member) => member.id === id))
      return fail(401, "Your session has ended. Sign in again.", {
        code: "session_ended",
      })
    return HttpResponse.json({ success: true, access: issue(id) })
  }),

  http.post(apiPath("/auth/logout/"), () => {
    setSessionUser(null)
    return HttpResponse.json({ success: true })
  }),

  http.get(apiPath("/auth/me/"), ({ request }) => {
    const member = bearerStaff(request)
    return member ? ok(toUser(member)) : unauthenticated()
  }),

  http.get(apiPath("/auth/lock-staff/"), async ({ request }) => {
    await delay()
    if (!bearerStaff(request)) return unauthenticated()
    return ok(
      staff
        .filter((member) => member.pin !== null)
        .map((member) => ({
          id: member.id,
          full_name: member.full_name,
          role: roleName(member),
        }))
    )
  }),

  http.post(apiPath("/auth/pin-unlock/"), async ({ request }) => {
    await delay()
    if (!bearerStaff(request)) return unauthenticated()
    const body = (await request.json()) as { user_id?: number; pin?: string }
    const member = staff.find((item) => item.id === body.user_id)
    if (!member || member.pin === null)
      return fail(403, "This staff member cannot unlock with a PIN.", {
        code: "pin_unavailable",
      })
    const attempts = pinAttempts.get(member.id) ?? { failed: 0, lockedUntil: 0 }
    const locked = () =>
      fail(403, "Too many wrong PINs. Ask a manager or try again later.", {
        code: "pin_locked",
      })
    if (attempts.lockedUntil > Date.now()) return locked()
    if (body.pin !== member.pin) {
      attempts.failed += 1
      if (attempts.failed >= PIN_MAX_ATTEMPTS) {
        pinAttempts.set(member.id, {
          failed: 0,
          lockedUntil: Date.now() + PIN_LOCK_MS,
        })
        return locked()
      }
      pinAttempts.set(member.id, attempts)
      return fail(403, "PIN is incorrect.", { code: "pin_incorrect" })
    }
    pinAttempts.delete(member.id)
    return HttpResponse.json({
      success: true,
      access: issue(member.id),
      expires_in: 900,
      user: toUser(member),
    })
  }),
]

/** Test helper: forget the mock session and PIN counters. */
export function resetMockAuth() {
  setSessionUser(null)
  pinAttempts.clear()
}
