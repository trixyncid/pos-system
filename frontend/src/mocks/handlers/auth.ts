import { delay, http, HttpResponse } from "msw"

import { staff, toUser } from "@/mocks/db/staff.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

/**
 * Stands in for the httpOnly refresh cookie. Kept in localStorage so a page
 * reload keeps the tablet signed in, as the real cookie would.
 */
const sessionKey = "pos.mock.session"

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
  return staff.find((member) => member.id === id && member.is_active)
}

function unauthenticated() {
  return fail(401, "Authentication credentials were not provided.", {
    code: "not_authenticated",
  })
}

export const authHandlers = [
  http.post(apiPath("/auth/login/"), async ({ request }) => {
    await delay()
    const body = (await request.json()) as {
      username?: string
      password?: string
    }
    // Like the API: a username, or an email for accounts that have one.
    const login = body.username?.trim().toLowerCase() ?? ""
    const member = staff.find(
      (item) =>
        item.is_active &&
        (login.includes("@")
          ? item.email === login
          : item.username === login) &&
        item.password !== null &&
        item.password === body.password
    )
    if (!member)
      return fail(401, "Username or password is incorrect.", {
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
]

/** Test helper: forget the mock session. */
export function resetMockAuth() {
  setSessionUser(null)
}
