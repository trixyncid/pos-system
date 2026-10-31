/**
 * Thirty days of paid orders, so the dashboard and reports have something
 * to show. Seeded random, so every reload tells the same story: a lunch
 * and a dinner peak, busier weekends, a steady snack bar.
 */
import type { Order, OrderLine } from "@/features/ordering/schemas/order.ts"
import { audit } from "@/mocks/db/audit.ts"
import { products } from "@/mocks/db/catalog.ts"
import { blankOrder, makeLine, orders, recompute } from "@/mocks/db/orders.ts"
import { staff } from "@/mocks/db/staff.ts"

function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}
const random = seeded(20_261_030)
const pick = <T>(items: readonly T[]) =>
  items[Math.floor(random() * items.length)]!
const between = (low: number, high: number) =>
  low + Math.floor(random() * (high - low + 1))

/** Restaurant orders per hour, 10:00–22:00: a lunch and a dinner rush. */
const restaurantCurve = [1, 2, 6, 7, 4, 2, 2, 3, 6, 8, 6, 3, 1]
const waiters = ["Sari Lestari", "Agus Setiawan"]
const manager = staff.find((m) => m.full_name === "Dimas Pratama")!
const cashier = staff.find((m) => m.full_name === "Budi Santoso")!

function lineOf(product: (typeof products)[number], quantity: number) {
  return makeLine(product.name, quantity, { status: "sent" })
}

function paid(
  order: Order,
  lines: OrderLine[],
  closed: Date,
  { discount }: { discount?: number } = {}
) {
  order.lines = lines
  if (discount) {
    order.discount_kind = "percent"
    order.discount_value = discount
    order.discount_reason = pick(["Pelanggan tetap", "Promo", "Komplain"])
  }
  recompute(order)
  order.status = "paid"
  order.payments = [
    {
      id: crypto.randomUUID(),
      method: "cash",
      amount: order.bill.total,
      tendered: Math.ceil(order.bill.total / 50_000) * 50_000,
      change: Math.ceil(order.bill.total / 50_000) * 50_000 - order.bill.total,
      received_by_name: cashier.full_name,
      created_at: closed.toISOString(),
    },
  ]
  recompute(order)
  order.closed_at = closed.toISOString()
  orders.push(order)
}

export function generateHistory(now = new Date()) {
  const menu = products.filter((p) => p.kind === "menu" && p.is_active)
  const food = menu.filter(
    (p) =>
      p.category_name !== "Minuman Dingin" &&
      p.category_name !== "Minuman Panas"
  )
  const drinks = menu.filter((p) => !food.includes(p))
  const retail = products.filter((p) => p.kind === "retail" && p.is_active)

  // Today is always a full trading day, even early in the morning, so the
  // demo dashboard and reports never look empty (some times may be later than now).
  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    const day = new Date(now)
    day.setDate(day.getDate() - daysAgo)
    const weekend = day.getDay() === 0 || day.getDay() === 6
    let number = 100

    restaurantCurve.forEach((weight, offset) => {
      const hour = 10 + offset
      const count = Math.round(
        weight * (weekend ? 1.4 : 1) * (0.7 + random() * 0.6)
      )
      for (let n = 0; n < count; n++) {
        const closed = new Date(day)
        closed.setHours(hour, between(0, 59), between(0, 59), 0)
        const guests = between(1, 6)
        const lines: OrderLine[] = []
        for (let g = 0; g < guests; g++) {
          lines.push(lineOf(pick(food), 1))
          if (random() < 0.85) lines.push(lineOf(pick(drinks), 1))
        }
        if (random() < 0.05) {
          const voided = lines[0]!
          voided.status = "void"
          voided.void_reason = pick([
            "Salah input",
            "Tamu batal",
            "Terlalu lama",
          ])
          audit(
            "order.void_item",
            manager,
            `#${number} · ${voided.quantity}× ${voided.name}`,
            {
              amount: voided.total,
              reason: voided.void_reason,
              approved_by: manager.full_name,
            },
            closed.toISOString()
          )
        }
        const table = `${between(1, 17)}`
        const order = blankOrder({
          id: crypto.randomUUID(),
          table: null,
          table_label: table,
          guests,
          waiter: pick(waiters),
          created_at: new Date(
            closed.getTime() - between(35, 80) * 60_000
          ).toISOString(),
          number: number++,
        })
        const discount = random() < 0.06 ? pick([5, 10, 15]) : undefined
        paid(order, lines, closed, { discount })
        if (discount)
          audit(
            "order.discount",
            manager,
            `#${order.number}`,
            {
              kind: "percent",
              value: discount,
              reason: order.discount_reason,
              approved_by: manager.full_name,
            },
            closed.toISOString()
          )
      }
    })

    // The snack bar: steady from 9:00 to 21:00, a little busier after school.
    for (let hour = 9; hour <= 21; hour++) {
      const count = between(0, hour >= 15 && hour <= 18 ? 4 : 2)
      for (let n = 0; n < count; n++) {
        const closed = new Date(day)
        closed.setHours(hour, between(0, 59), between(0, 59), 0)
        const lines = Array.from({ length: between(1, 3) }, () =>
          lineOf(pick(retail), between(1, 2))
        )
        const order = blankOrder({
          id: crypto.randomUUID(),
          channel: "snackbar",
          type: "takeaway",
          table: null,
          table_label: "",
          guests: 1,
          waiter: cashier.full_name,
          created_at: closed.toISOString(),
          number: number++,
        })
        paid(order, lines, closed)
      }
    }

    if (daysAgo > 0) {
      const close = new Date(day)
      close.setHours(22, 30, 0, 0)
      audit(
        "shift.close",
        cashier,
        "",
        { variance: pick([0, 0, 0, -2_000, 1_000]) },
        close.toISOString()
      )
    }
  }
}
