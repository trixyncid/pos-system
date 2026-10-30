import { delay, http } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import type { Shift } from "@/features/shifts/schemas/shift.ts"
import { mockId } from "@/mocks/db/catalog.ts"
import { orders, pushJob } from "@/mocks/db/orders.ts"
import { currentShift, refreshTotals, shifts } from "@/mocks/db/shifts.ts"
import { permissionsOf, type MockStaff } from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"
import { bus } from "@/realtime/bus.ts"

const readers = [
  perm.openShift,
  perm.closeShift,
  perm.takePayment,
  perm.openDrawer,
]

function actorWith(request: Request, anyOf: readonly string[]) {
  const actor = bearerStaff(request)
  if (!actor)
    return {
      error: fail(401, "Authentication credentials were not provided.", {
        code: "not_authenticated",
      }),
    }
  const held = permissionsOf(actor)
  if (!anyOf.some((permission) => held.includes(permission)))
    return {
      error: fail(403, "You do not have permission to perform this action.", {
        code: "permission_denied",
      }),
    }
  return { actor }
}

function findOpen(id: unknown) {
  const shift = shifts.find((s) => s.id === id)
  if (!shift) return { error: fail(404, "Not found.") }
  if (shift.closed_at) return { error: fail(400, "This shift is closed.") }
  return { shift }
}

/** backend printing/tickets.shift_payload */
function printReport(shift: Shift, actor: MockStaff) {
  const job = pushJob({
    kind: "shift",
    station: "cashier",
    by: actor.full_name,
    at: new Date().toISOString(),
    lines: [],
    shift: {
      opened_at: shift.created_at,
      closed_at: shift.closed_at,
      opened_by: shift.opened_by_name,
      opening_cash: shift.opening_cash,
      ...shift.totals,
      counted_cash: shift.counted_cash,
      variance: shift.variance,
      unpaid_bills: orders.filter((o) => o.status === "billed").length,
      movements: shift.movements.map(({ kind, amount, reason }) => ({
        kind,
        amount,
        reason,
      })),
    },
  })
  bus.emit("print", { type: "print.job", id: job.id, station: job.station })
}

export const shiftHandlers = [
  http.get(apiPath("/shifts/"), async ({ request }) => {
    const { error } = actorWith(request, readers)
    if (error) return error
    await delay()
    return ok(
      [...shifts]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20)
    )
  }),

  http.get(apiPath("/shifts/current/"), async ({ request }) => {
    const { error } = actorWith(request, readers)
    if (error) return error
    await delay()
    const shift = currentShift()
    return ok(shift ? refreshTotals(shift) : null)
  }),

  http.post(apiPath("/shifts/"), async ({ request }) => {
    const { actor, error } = actorWith(request, [perm.openShift])
    if (error) return error
    await delay()
    if (currentShift())
      return fail(400, "A shift is already open. Close it first.")
    const { opening_cash } = (await request.json()) as { opening_cash: number }
    const shift: Shift = refreshTotals({
      id: mockId(),
      created_at: new Date().toISOString(),
      opened_by_name: actor.full_name,
      opening_cash,
      closed_at: null,
      closed_by_name: null,
      counted_cash: null,
      expected_cash: null,
      variance: null,
      note: "",
      totals: {
        cash_sales: 0,
        other_sales: 0,
        cash_in: 0,
        cash_out: 0,
        expected_cash: 0,
        payments: 0,
      },
      movements: [],
    })
    shifts.push(shift)
    return ok(shift, { status: 201 })
  }),

  http.post(apiPath("/shifts/:id/movements/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, [perm.openDrawer])
    if (error) return error
    await delay()
    const found = findOpen(params.id)
    if (found.error) return found.error
    const body = (await request.json()) as {
      kind: "in" | "out"
      amount: number
      reason: string
    }
    if (!body.reason.trim())
      return fail(400, "Say why.", { errors: { reason: ["Say why."] } })
    if (body.kind === "out" && body.amount > found.shift.totals.expected_cash)
      return fail(400, "There isn't that much cash in the drawer.", {
        errors: { amount: ["There isn't that much cash in the drawer."] },
      })
    found.shift.movements.push({
      id: mockId(),
      kind: body.kind,
      amount: body.amount,
      reason: body.reason.trim(),
      by_name: actor.full_name,
      created_at: new Date().toISOString(),
    })
    return ok(refreshTotals(found.shift))
  }),

  http.post(apiPath("/shifts/:id/close/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, [perm.closeShift])
    if (error) return error
    await delay(500)
    const found = findOpen(params.id)
    if (found.error) return found.error
    const body = (await request.json()) as {
      counted_cash: number
      note?: string
    }
    const shift = refreshTotals(found.shift)
    Object.assign(shift, {
      expected_cash: shift.totals.expected_cash,
      counted_cash: body.counted_cash,
      variance: body.counted_cash - shift.totals.expected_cash,
      closed_by_name: actor.full_name,
      closed_at: new Date().toISOString(),
      note: (body.note ?? "").trim(),
    })
    printReport(shift, actor)
    return ok(shift)
  }),
]
