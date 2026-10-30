import { delay, http, HttpResponse } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import type { Order } from "@/features/ordering/schemas/order.ts"
import type { Figures } from "@/features/reports/schemas/reports.ts"
import { auditEvents } from "@/mocks/db/audit.ts"
import { products } from "@/mocks/db/catalog.ts"
import { areas } from "@/mocks/db/floor.ts"
import { generateHistory } from "@/mocks/db/history.ts"
import { trackedProducts, statusOf } from "@/mocks/db/inventory.ts"
import { orders } from "@/mocks/db/orders.ts"
import { permissionsOf } from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

generateHistory()

function allowed(request: Request, permission: string) {
  const actor = bearerStaff(request)
  if (!actor)
    return fail(401, "Authentication credentials were not provided.", {
      code: "not_authenticated",
    })
  if (!permissionsOf(actor).includes(permission))
    return fail(403, "You do not have permission to perform this action.", {
      code: "permission_denied",
    })
  return null
}

const iso = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`

function parseDay(text: string | null, fallback: Date) {
  if (!text) return fallback
  const [y, m, d] = text.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

const addDays = (day: Date, days: number) => {
  const next = new Date(day)
  next.setDate(next.getDate() + days)
  return next
}

const closedAt = (order: Order) =>
  new Date(order.payments.at(-1)?.created_at ?? order.created_at)

/** Paid between the start of `first` and the end of `last`, or only `until` ms into `first`. */
function paidOn(first: Date, last: Date, until?: number) {
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate())
  const end = until
    ? new Date(start.getTime() + until)
    : addDays(new Date(last.getFullYear(), last.getMonth(), last.getDate()), 1)
  return orders.filter((o) => {
    if (o.status !== "paid") return false
    const at = closedAt(o)
    return at >= start && at < end
  })
}

/** backend reports.services.unit_cost */
function unitCost(productId: string): number | null {
  const product = products.find((p) => p.id === productId)
  if (!product) return null
  if (product.recipe.length) return product.recipe_cost ?? 0
  return product.kind === "menu" && product.cost === 0 ? null : product.cost
}

const live = (order: Order) => order.lines.filter((l) => l.status !== "void")
const orderCost = (order: Order) =>
  live(order).reduce(
    (sum, l) => sum + (unitCost(l.product) ?? 0) * l.quantity,
    0
  )

/** backend reports.services.Figures */
function figures(list: Order[]): Figures {
  const f = {
    orders: 0,
    covers: 0,
    gross: 0,
    discount: 0,
    service: 0,
    tax: 0,
    rounding: 0,
    sales: 0,
    cost: 0,
  }
  for (const o of list) {
    f.orders += 1
    if (o.channel === "restaurant") f.covers += o.guests
    f.gross += o.bill.subtotal
    f.discount += o.bill.discount
    f.service += o.bill.service
    f.tax += o.bill.tax
    f.rounding += o.bill.rounding
    f.sales += o.bill.total
    f.cost += orderCost(o)
  }
  const net = f.gross - f.discount
  return {
    ...f,
    cost: Math.round(f.cost),
    net,
    food_cost_percent: net ? Math.round((f.cost / net) * 1_000) / 10 : null,
    average_ticket: f.orders ? Math.round(f.sales / f.orders) : 0,
  }
}

function ranked<T extends Record<string, number>>(
  rows: Map<string, T>,
  key: keyof T,
  limit?: number
) {
  const list = [...rows].map(([name, row]) => ({ name, ...row }))
  list.sort((a, b) => (b[key] as number) - (a[key] as number))
  return limit ? list.slice(0, limit) : list
}

function bump<T extends Record<string, number>>(
  rows: Map<string, T>,
  name: string,
  empty: T,
  add: Partial<T>
) {
  const row = rows.get(name) ?? { ...empty }
  for (const [key, value] of Object.entries(add))
    (row as Record<string, number>)[key] = (row[key] ?? 0) + (value as number)
  rows.set(name, row)
}

function range(request: Request) {
  const url = new URL(request.url)
  const today = new Date()
  const last = parseDay(url.searchParams.get("to"), today)
  const first = parseDay(url.searchParams.get("from"), addDays(last, -6))
  return { first, last }
}

export const reportHandlers = [
  http.get(apiPath("/reports/dashboard/"), async ({ request }) => {
    const denied = allowed(request, perm.viewDashboard)
    if (denied) return denied
    await delay(300)
    const day = parseDay(
      new URL(request.url).searchParams.get("date"),
      new Date()
    )
    const list = paidOn(day, day)
    const hourly = Array.from({ length: 24 }, () => 0)
    const items = new Map<string, { quantity: number; revenue: number }>()
    const waiters = new Map<string, { orders: number; sales: number }>()
    const voids = new Map<string, { count: number; amount: number }>()
    const discounts = new Map<string, { count: number; amount: number }>()
    for (const o of list) {
      hourly[closedAt(o).getHours()]! += o.bill.total
      bump(
        waiters,
        o.waiter,
        { orders: 0, sales: 0 },
        { orders: 1, sales: o.bill.total }
      )
      if (o.bill.discount)
        bump(
          discounts,
          o.promo_name ? `Promo · ${o.promo_name}` : "Dimas Pratama",
          { count: 0, amount: 0 },
          { count: 1, amount: o.bill.discount }
        )
      for (const l of o.lines) {
        if (l.status === "void")
          bump(
            voids,
            "Dimas Pratama",
            { count: 0, amount: 0 },
            { count: 1, amount: l.total }
          )
        else
          bump(
            items,
            l.name,
            { quantity: 0, revenue: 0 },
            { quantity: l.quantity, revenue: l.total }
          )
      }
    }
    // backend reports.services.dashboard: a day in progress is compared hour for hour.
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
    const elapsed = Date.now() - dayStart.getTime()
    const cutoff = elapsed > 0 && elapsed < 86_400_000 ? elapsed : undefined
    const compare = (other: Date) => {
      const past = figures(paidOn(other, other, cutoff))
      return {
        date: iso(other),
        sales: past.sales,
        orders: past.orders,
        partial: cutoff !== undefined,
      }
    }
    const tables = areas.flatMap((a) => a.tables).length
    return ok({
      date: iso(day),
      ...figures(list),
      yesterday: compare(addDays(day, -1)),
      last_week: compare(addDays(day, -7)),
      hourly,
      channels: {
        restaurant: figures(list.filter((o) => o.channel === "restaurant")),
        snackbar: figures(list.filter((o) => o.channel === "snackbar")),
      },
      top_items: ranked(items, "revenue", 8),
      waiters: ranked(waiters, "sales"),
      voids: ranked(voids, "amount"),
      discounts: ranked(discounts, "amount"),
      table_turns: tables
        ? Math.round(
            (list.filter((o) => o.table_label).length / tables) * 100
          ) / 100
        : null,
      low_stock: trackedProducts().filter((p) => statusOf(p) !== "ok").length,
    })
  }),

  http.get(apiPath("/reports/sales/"), async ({ request }) => {
    const denied = allowed(request, perm.viewReports)
    if (denied) return denied
    await delay(300)
    const { first, last } = range(request)
    if (first > last)
      return fail(400, "Comes after the end date.", {
        errors: { from: ["Comes after the end date."] },
      })
    const rows = []
    for (let day = first; day <= last; day = addDays(day, 1))
      rows.push({ date: iso(day), ...figures(paidOn(day, day)) })
    return ok({ from: iso(first), to: iso(last), rows })
  }),

  http.get(apiPath("/reports/items/"), async ({ request }) => {
    const denied = allowed(request, perm.viewReports)
    if (denied) return denied
    await delay(300)
    const { first, last } = range(request)
    const rows = new Map<
      string,
      {
        product: string
        name: string
        kind: "menu" | "retail" | "ingredient"
        channel_restaurant: number
        channel_snackbar: number
        quantity: number
        revenue: number
        cost: number | null
      }
    >()
    for (const o of paidOn(first, last))
      for (const l of live(o)) {
        const product = products.find((p) => p.id === l.product)
        const row = rows.get(l.product) ?? {
          product: l.product,
          name: l.name,
          kind: product?.kind ?? "menu",
          channel_restaurant: 0,
          channel_snackbar: 0,
          quantity: 0,
          revenue: 0,
          cost: 0,
        }
        row.quantity += l.quantity
        row[`channel_${o.channel}`] += l.quantity
        row.revenue += l.total
        const unit = unitCost(l.product)
        row.cost =
          unit === null || row.cost === null
            ? null
            : row.cost + unit * l.quantity
        rows.set(l.product, row)
      }
    return ok({
      from: iso(first),
      to: iso(last),
      rows: [...rows.values()]
        .map((row) => ({
          ...row,
          cost: row.cost === null ? null : Math.round(row.cost),
          margin: row.cost === null ? null : row.revenue - Math.round(row.cost),
        }))
        .sort((a, b) => b.revenue - a.revenue),
    })
  }),

  http.get(apiPath("/audit/events/"), async ({ request }) => {
    const denied = allowed(request, perm.viewAudit)
    if (denied) return denied
    await delay()
    const url = new URL(request.url)
    const action = url.searchParams.get("action")
    const search = url.searchParams.get("search")?.trim().toLowerCase()
    const date = url.searchParams.get("date")
    const rows = [...auditEvents]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .filter(
        (e) =>
          (!action || e.action.startsWith(action)) &&
          (!search ||
            e.actor_name.toLowerCase().includes(search) ||
            e.target_label.toLowerCase().includes(search) ||
            e.action.includes(search)) &&
          (!date || iso(new Date(e.created_at)) === date)
      )
    const size = Number(url.searchParams.get("page_size") ?? 20)
    const page = Number(url.searchParams.get("page") ?? 1)
    return HttpResponse.json({
      success: true,
      count: rows.length,
      next: page * size < rows.length ? `?page=${page + 1}` : null,
      previous: page > 1 ? `?page=${page - 1}` : null,
      results: rows.slice((page - 1) * size, page * size),
    })
  }),
]
