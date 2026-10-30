import { delay, http, HttpResponse } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import type { Movement } from "@/features/inventory/schemas/inventory.ts"
import { audit } from "@/mocks/db/audit.ts"
import { products } from "@/mocks/db/catalog.ts"
import {
  movements,
  record,
  stock,
  stockItem,
  trackedProducts,
} from "@/mocks/db/inventory.ts"
import { permissionsOf } from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

function storekeeper(request: Request) {
  const actor = bearerStaff(request)
  if (!actor)
    return {
      error: fail(401, "Authentication credentials were not provided.", {
        code: "not_authenticated",
      }),
    }
  if (!permissionsOf(actor).includes(perm.manageStock))
    return {
      error: fail(403, "You do not have permission to perform this action.", {
        code: "permission_denied",
      }),
    }
  return { actor }
}

function paged<T>(request: Request, rows: T[]) {
  const url = new URL(request.url)
  const size = Number(url.searchParams.get("page_size") ?? 20)
  const page = Number(url.searchParams.get("page") ?? 1)
  return HttpResponse.json({
    success: true,
    count: rows.length,
    next: page * size < rows.length ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results: rows.slice((page - 1) * size, page * size),
  })
}

const tracked = (id: unknown) =>
  trackedProducts().find((product) => product.id === id)

/** Retried deliveries and counts, by their id (backend StockMovement.reference). */
const batches = new Map<string, Movement[]>()

export const inventoryHandlers = [
  http.get(apiPath("/inventory/stock/summary/"), async ({ request }) => {
    const { error } = storekeeper(request)
    if (error) return error
    await delay()
    const items = trackedProducts().map(stockItem)
    return ok({
      tracked: items.length,
      low: items.filter((i) => i.status === "low").length,
      out: items.filter((i) => i.status === "out").length,
      value: items.reduce((sum, i) => sum + i.value, 0),
    })
  }),

  http.get(apiPath("/inventory/stock/"), async ({ request }) => {
    const { error } = storekeeper(request)
    if (error) return error
    await delay()
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.trim().toLowerCase()
    const kind = url.searchParams.get("kind")
    const status = url.searchParams.get("status")
    const rows = trackedProducts()
      .map(stockItem)
      .filter(
        (item) =>
          (!search ||
            item.name.toLowerCase().includes(search) ||
            item.sku.toLowerCase().includes(search) ||
            item.barcode === search) &&
          (!kind || item.kind === kind) &&
          (!status || item.status === status)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
    return paged(request, rows)
  }),

  http.get(apiPath("/inventory/movements/"), async ({ request }) => {
    const { error } = storekeeper(request)
    if (error) return error
    await delay()
    const url = new URL(request.url)
    const product = url.searchParams.get("product")
    const kinds = url.searchParams.get("kind")?.split(",")
    return paged(
      request,
      [...movements]
        .reverse()
        .filter(
          (m) =>
            (!product || m.product === product) &&
            (!kinds || kinds.includes(m.kind))
        )
    )
  }),

  http.post(apiPath("/inventory/movements/receive/"), async ({ request }) => {
    const { actor, error } = storekeeper(request)
    if (error) return error
    await delay(400)
    const body = (await request.json()) as {
      id: string
      supplier?: string
      note?: string
      lines: { product: string; quantity: number; unit_cost: number }[]
    }
    const done = batches.get(body.id)
    if (done) return ok(done, { status: 201 })
    if (body.lines.some((line) => !tracked(line.product)))
      return fail(400, "Some items don't track stock.", {
        errors: { lines: ["Some items don't track stock."] },
      })
    const reason = [body.supplier?.trim(), body.note?.trim()]
      .filter(Boolean)
      .join(" · ")
    const made = body.lines.map((line) => {
      const product = tracked(line.product)!
      const onHand = Math.max(stock.get(product.id) ?? 0, 0)
      if (onHand + line.quantity > 0)
        product.cost = Math.round(
          (onHand * product.cost + line.quantity * line.unit_cost) /
            (onHand + line.quantity)
        )
      return record(product, line.quantity, "receive", actor.full_name, {
        unit_cost: line.unit_cost,
        reason,
      })
    })
    batches.set(body.id, made)
    audit("stock.receive", actor, body.supplier ?? "", { items: made.length })
    return ok(made, { status: 201 })
  }),

  http.post(apiPath("/inventory/movements/waste/"), async ({ request }) => {
    const { actor, error } = storekeeper(request)
    if (error) return error
    await delay()
    const body = (await request.json()) as {
      product: string
      quantity: number
      reason: string
    }
    const product = tracked(body.product)
    if (!product)
      return fail(400, "This item doesn't track stock.", {
        errors: { product: ["This item doesn't track stock."] },
      })
    if (!body.reason.trim())
      return fail(400, "Say why.", { errors: { reason: ["Say why."] } })
    audit("stock.waste", actor, product.name, {
      quantity: body.quantity,
      reason: body.reason.trim(),
    })
    return ok(
      record(product, -body.quantity, "waste", actor.full_name, {
        reason: body.reason.trim(),
      }),
      { status: 201 }
    )
  }),

  http.post(apiPath("/inventory/movements/count/"), async ({ request }) => {
    const { actor, error } = storekeeper(request)
    if (error) return error
    await delay(400)
    const body = (await request.json()) as {
      id: string
      note?: string
      lines: { product: string; counted: number }[]
    }
    const done = batches.get(body.id)
    if (done) return ok(done, { status: 201 })
    const made: Movement[] = []
    for (const line of body.lines) {
      const product = products.find((p) => p.id === line.product)
      if (!product?.track_stock) continue
      const delta = line.counted - (stock.get(product.id) ?? 0)
      if (delta)
        made.push(
          record(product, delta, "count", actor.full_name, {
            reason: body.note?.trim() ?? "",
          })
        )
    }
    batches.set(body.id, made)
    audit("stock.count", actor, "", {
      counted: body.lines.length,
      adjusted: made.length,
    })
    return ok(made, { status: 201 })
  }),
]
