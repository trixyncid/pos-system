import type { Product } from "@/features/catalog/schemas/catalog.ts"
import type {
  Movement,
  MovementKind,
  StockItem,
} from "@/features/inventory/schemas/inventory.ts"
import type { OrderLine } from "@/features/ordering/schemas/order.ts"
import { mockId, products } from "@/mocks/db/catalog.ts"

/** On hand per product (backend Product.stock). */
export const stock = new Map<string, number>()
/** The ledger, oldest first (backend StockMovement). */
export const movements: Movement[] = []

const tracked = () => products.filter((p) => p.track_stock && p.is_active)

export function record(
  product: Product,
  delta: number,
  kind: MovementKind,
  by: string,
  extra: Partial<Pick<Movement, "unit_cost" | "reason" | "order_number">> & {
    at?: string
  } = {}
) {
  const balance =
    Math.round(((stock.get(product.id) ?? 0) + delta) * 1_000) / 1_000
  stock.set(product.id, balance)
  const movement: Movement = {
    id: mockId(),
    product: product.id,
    product_name: product.name,
    unit: product.unit,
    kind,
    quantity: delta,
    balance,
    unit_cost: extra.unit_cost ?? null,
    reason: extra.reason ?? "",
    order_number: extra.order_number ?? null,
    by_name: by,
    created_at: extra.at ?? new Date().toISOString(),
  }
  movements.push(movement)
  return movement
}

/** backend inventory.services.sale_deltas + deduct_sale */
export function deductSale(
  orderNumber: number,
  lines: OrderLine[],
  by: string
) {
  const deltas = new Map<string, number>()
  for (const line of lines) {
    const product = products.find((p) => p.id === line.product)
    if (!product) continue
    if (product.track_stock)
      deltas.set(product.id, (deltas.get(product.id) ?? 0) - line.quantity)
    for (const recipeLine of product.recipe) {
      const ingredient = products.find((p) => p.id === recipeLine.ingredient)
      if (ingredient?.track_stock)
        deltas.set(
          ingredient.id,
          (deltas.get(ingredient.id) ?? 0) - recipeLine.quantity * line.quantity
        )
    }
  }
  for (const [id, delta] of deltas) {
    const product = products.find((p) => p.id === id)
    if (product && delta)
      record(product, delta, "sale", by, { order_number: orderNumber })
  }
}

/** backend inventory.services.return_void */
export function returnVoid(orderNumber: number, line: OrderLine, by: string) {
  const product = products.find((p) => p.id === line.product)
  if (product?.track_stock)
    record(product, line.quantity, "void", by, {
      order_number: orderNumber,
      reason: line.void_reason,
    })
}

export function statusOf(product: Product) {
  const onHand = stock.get(product.id) ?? 0
  if (onHand <= 0) return "out" as const
  if (
    product.low_stock_threshold !== null &&
    onHand <= product.low_stock_threshold
  )
    return "low" as const
  return "ok" as const
}

export function stockItem(product: Product): StockItem {
  const onHand = stock.get(product.id) ?? 0
  return {
    id: product.id,
    name: product.name,
    kind: product.kind,
    unit: product.unit,
    sku: product.sku,
    barcode: product.barcode,
    category_name: product.category_name,
    image_url: product.image_url,
    stock: onHand,
    low_stock_threshold: product.low_stock_threshold,
    cost: product.cost,
    value: Math.round(Math.max(onHand, 0) * product.cost),
    status: statusOf(product),
  }
}

export const trackedProducts = tracked

// --- Seed: a delivery two days ago, then a little history ---------------------
const daysAgo = (days: number, hour: number) => {
  const at = new Date()
  at.setDate(at.getDate() - days)
  at.setHours(hour, 0, 0, 0)
  return at.toISOString()
}

tracked().forEach((product, index) => {
  const threshold = product.low_stock_threshold ?? 5
  // Most items comfortably stocked, every seventh low and every eleventh out.
  const target =
    index % 11 === 3
      ? 0
      : index % 7 === 2
        ? Math.round(threshold * 0.6)
        : Math.round(threshold * (2 + (index % 5)))
  record(
    product,
    target + Math.round(threshold * 0.5),
    "receive",
    "Wati Rahayu",
    {
      unit_cost: product.cost,
      reason: product.kind === "retail" ? "Toko Sumber Rejeki" : "Pasar Induk",
      at: daysAgo(2, 9),
    }
  )
  const used = Math.round(threshold * 0.5)
  if (used)
    record(product, -used, "sale", "Sari Lestari", { at: daysAgo(1, 13) })
})
const egg = tracked().find((p) => p.name === "Telur")
if (egg)
  record(egg, -4, "waste", "Wati Rahayu", {
    reason: "Pecah saat dibongkar",
    at: daysAgo(1, 10),
  })
