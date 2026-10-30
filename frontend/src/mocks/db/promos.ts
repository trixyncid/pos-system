/**
 * Promos for the mock API, with the same rules as backend promos/services.py:
 * when a promo is on, and what it takes off a bill.
 */
import type { OrderLine } from "@/features/ordering/schemas/order.ts"
import type { Promo } from "@/features/promos/schemas/promo.ts"
import { categories, mockId, products } from "@/mocks/db/catalog.ts"
import { percentOf } from "@/lib/money.ts"

export const promos: Promo[] = []

const categoryId = (name: string) => categories.find((c) => c.name === name)!.id
const productId = (name: string) => products.find((p) => p.name === name)!.id

function seed(fields: Partial<Promo> & Pick<Promo, "name" | "kind" | "value">) {
  promos.push({
    id: mockId(),
    description: "",
    image_url: null,
    benefit: "percent",
    max_discount: null,
    min_spend: 0,
    products: [],
    categories: [],
    buy_quantity: null,
    get_quantity: null,
    channel: "all",
    starts_on: null,
    ends_on: null,
    weekdays: [],
    starts_at: null,
    ends_at: null,
    is_active: true,
    created_at: new Date().toISOString(),
    ...fields,
  })
}

seed({
  name: "Happy hour minuman",
  description: "Semua minuman dingin 20% lebih murah, Senin–Kamis sore.",
  kind: "items",
  value: 20,
  categories: [categoryId("Minuman Dingin")],
  weekdays: [0, 1, 2, 3],
  starts_at: "14:00:00",
  ends_at: "17:00:00",
  channel: "restaurant",
})
seed({
  name: "Beli 2 gratis 1 Es Teh",
  kind: "bundle",
  value: 100,
  buy_quantity: 2,
  get_quantity: 1,
  products: [productId("Es Teh Manis")],
})
seed({
  name: "Hemat 10% belanja Rp 150 rb",
  description: "Maksimal potongan Rp 30.000.",
  kind: "bill",
  value: 10,
  min_spend: 150_000,
  max_discount: 30_000,
})
seed({
  name: "Promo akhir pekan",
  kind: "bill",
  benefit: "amount",
  value: 25_000,
  min_spend: 200_000,
  weekdays: [5, 6],
})

const clock = (text: string) => {
  const [h = 0, m = 0] = text.split(":").map(Number)
  return h * 60 + m
}

/** backend promos.services.unavailable_reason */
export function unavailableReason(
  promo: Promo,
  channel: string,
  now = new Date()
) {
  if (!promo.is_active) return "inactive"
  if (promo.channel !== "all" && promo.channel !== channel) return "channel"
  const pad = (n: number) => String(n).padStart(2, "0")
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  if (promo.starts_on && today < promo.starts_on) return "not_started"
  if (promo.ends_on && today > promo.ends_on) return "ended"
  const weekday = (now.getDay() + 6) % 7 // Monday = 0, like Python.
  if (promo.weekdays.length && !promo.weekdays.includes(weekday)) return "day"
  if (promo.starts_at && promo.ends_at) {
    const minute = now.getHours() * 60 + now.getMinutes()
    const start = clock(promo.starts_at)
    const end = clock(promo.ends_at)
    const inside =
      start < end
        ? minute >= start && minute < end
        : minute >= start || minute < end
    if (!inside) return "time"
  }
  return null
}

function covers(promo: Promo, productId: string) {
  const product = products.find((p) => p.id === productId)
  return (
    promo.products.includes(productId) ||
    (product?.category !== null &&
      product?.category !== undefined &&
      promo.categories.includes(product.category))
  )
}

/** backend promos.services.discount */
export function promoDiscount(promo: Promo, lines: OrderLine[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0)
  if (!subtotal || subtotal < promo.min_spend) return 0
  let off = 0
  if (promo.kind === "bill") {
    off =
      promo.benefit === "percent"
        ? percentOf(subtotal, promo.value)
        : promo.value
  } else if (promo.kind === "items") {
    for (const line of lines) {
      if (!covers(promo, line.product)) continue
      const each =
        promo.benefit === "percent"
          ? percentOf(line.unit_price, promo.value)
          : promo.benefit === "amount"
            ? Math.min(promo.value, line.unit_price)
            : Math.max(0, line.unit_price - promo.value)
      off += each * line.quantity
    }
  } else {
    const units = lines
      .filter((l) => covers(promo, l.product))
      .flatMap((l) => Array.from({ length: l.quantity }, () => l.unit_price))
      .sort((a, b) => b - a)
    const group = (promo.buy_quantity ?? 1) + (promo.get_quantity ?? 1)
    const free = Math.floor(units.length / group) * (promo.get_quantity ?? 1)
    off = units
      .slice(units.length - free)
      .reduce((sum, price) => sum + percentOf(price, promo.value), 0)
    if (!free) off = 0
  }
  if (promo.max_discount !== null) off = Math.min(off, promo.max_discount)
  return Math.min(off, subtotal)
}
