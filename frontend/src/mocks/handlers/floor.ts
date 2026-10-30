import { delay, http } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import type { FloorTable, TableLayout } from "@/features/floor/schemas/floor.ts"
import { mockId } from "@/mocks/db/catalog.ts"
import { areas } from "@/mocks/db/floor.ts"
import { withOccupancy } from "@/mocks/db/orders.ts"
import { permissionsOf } from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

function guard(request: Request, permission?: string) {
  const actor = bearerStaff(request)
  if (!actor)
    return fail(401, "Authentication credentials were not provided.", {
      code: "not_authenticated",
    })
  if (permission && !permissionsOf(actor).includes(permission))
    return fail(403, "You do not have permission to perform this action.", {
      code: "permission_denied",
    })
  return null
}

const sorted = () =>
  [...areas].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  )

export const floorHandlers = [
  http.get(apiPath("/floor/areas/"), async ({ request }) => {
    const error = guard(request)
    if (error) return error
    await delay()
    const all = new URL(request.url).searchParams.get("all") === "true"
    return ok(
      sorted()
        .filter((area) => all || area.is_active)
        .map((area) => ({ ...area, tables: area.tables.map(withOccupancy) }))
    )
  }),

  http.post(apiPath("/floor/areas/"), async ({ request }) => {
    const error = guard(request, perm.editFloor)
    if (error) return error
    await delay()
    const { name } = (await request.json()) as { name?: string }
    if (!name?.trim())
      return fail(400, "This field may not be blank.", {
        errors: { name: ["This field may not be blank."] },
      })
    if (areas.some((a) => a.name.toLowerCase() === name.trim().toLowerCase()))
      return fail(400, "Another area has this name.", {
        errors: { name: ["Another area has this name."] },
      })
    const area = {
      id: mockId(),
      name: name.trim(),
      sort_order: areas.length,
      is_active: true,
      tables: [],
    }
    areas.push(area)
    return ok(area, { status: 201 })
  }),

  http.patch(apiPath("/floor/areas/:id/"), async ({ request, params }) => {
    const error = guard(request, perm.editFloor)
    if (error) return error
    await delay()
    const area = areas.find((a) => a.id === params.id)
    if (!area) return fail(404, "Not found.")
    const body = (await request.json()) as {
      name?: string
      is_active?: boolean
    }
    if (body.name !== undefined) area.name = body.name.trim()
    if (body.is_active !== undefined) area.is_active = body.is_active
    return ok(area)
  }),

  http.delete(apiPath("/floor/areas/:id/"), async ({ request, params }) => {
    const error = guard(request, perm.editFloor)
    if (error) return error
    await delay()
    const index = areas.findIndex((a) => a.id === params.id)
    if (index < 0) return fail(404, "Not found.")
    areas.splice(index, 1)
    return ok(undefined)
  }),

  http.put(apiPath("/floor/areas/:id/layout/"), async ({ request, params }) => {
    const error = guard(request, perm.editFloor)
    if (error) return error
    await delay()
    const area = areas.find((a) => a.id === params.id)
    if (!area) return fail(404, "Not found.")
    const { tables } = (await request.json()) as {
      tables: (Partial<TableLayout> & { label: string })[]
    }
    const labels = tables.map((t) => t.label.trim())
    const duplicates = [
      ...new Set(labels.filter((label, i) => labels.indexOf(label) !== i)),
    ]
    if (duplicates.length) {
      const message = `Each table needs its own label: ${duplicates.join(", ")}.`
      return fail(400, message, { errors: { tables: [message] } })
    }
    const taken = areas
      .filter((a) => a !== area)
      .flatMap((a) => a.tables.map((t) => t.label))
      .filter((label) => labels.includes(label))
    if (taken.length) {
      const message = `Already used in another area: ${taken.join(", ")}.`
      return fail(400, message, { errors: { tables: [message] } })
    }
    const busy = area.tables
      .filter((t) => !tables.some((layout) => layout.id === t.id))
      .filter((t) => withOccupancy(t).order_id !== null)
      .map((t) => t.label)
    if (busy.length) {
      return fail(
        400,
        `Guests are seated at ${busy.join(", ")}; close their orders before removing them.`
      )
    }
    area.tables = tables.map((layout): FloorTable => {
      const existing = area.tables.find((t) => t.id === layout.id)
      return {
        // A table keeps its live state (guests, timer) when it is moved.
        ...(existing ?? {
          status: "available",
          seated_at: null,
          guests: null,
          order_total: null,
          waiter: null,
          order_id: null,
        }),
        id: layout.id ?? mockId(),
        label: layout.label.trim(),
        shape: layout.shape ?? "rect",
        x: layout.x ?? 500,
        y: layout.y ?? 350,
        width: layout.width ?? 90,
        height: layout.height ?? 90,
        rotation: layout.rotation ?? 0,
        capacity: layout.capacity ?? 4,
      }
    })
    return ok(area)
  }),
]
