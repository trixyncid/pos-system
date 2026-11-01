import { http } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import { permissionsOf } from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

/**
 * Customer displays in mock mode. Pairing and the live view travel between
 * browser tabs over a BroadcastChannel (features/display), so the only
 * server state to fake is the list in Settings: the display this browser's
 * cashier screen is paired with.
 */
const pairedKey = "pos.display.paired"

function paired() {
  try {
    const raw = window.localStorage.getItem(pairedKey)
    return raw ? (JSON.parse(raw) as { id: string; name: string }) : null
  } catch {
    return null
  }
}

function owner(request: Request) {
  const actor = bearerStaff(request)
  if (!actor) return fail(401, "Authentication credentials were not provided.")
  if (!permissionsOf(actor).includes(perm.manageSettings))
    return fail(403, "You do not have permission to perform this action.")
  return null
}

export const displayHandlers = [
  http.get(apiPath("/displays/"), ({ request }) => {
    const error = owner(request)
    if (error) return error
    const display = paired()
    return ok(
      display
        ? [
            {
              ...display,
              paired_at: new Date().toISOString(),
              paired_by_name: null,
              last_seen: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
          ]
        : []
    )
  }),
  http.delete(apiPath("/displays/:id/"), ({ request }) => {
    const error = owner(request)
    if (error) return error
    return ok(null)
  }),
]
