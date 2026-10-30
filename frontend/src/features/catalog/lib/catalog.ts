import type { Product } from "@/features/catalog/schemas/catalog.ts"

/** What one unit costs the outlet: the recipe when there is one, else the entered cost price. */
export function unitCost(product: Pick<Product, "recipe_cost" | "cost">) {
  return product.recipe_cost ?? product.cost
}

/** Cost as a share of price, e.g. 0.32. Null when there is no price or no cost to compare. */
export function costRatio(price: number, cost: number) {
  if (price <= 0 || cost <= 0) return null
  return cost / price
}

const percent = new Intl.NumberFormat("id-ID", {
  style: "percent",
  maximumFractionDigits: 0,
})

export function formatPercent(ratio: number) {
  return percent.format(ratio)
}

/**
 * Food cost above about a third of the price is where restaurants start
 * losing money; retail margins are thinner by nature, so they use their own bar.
 */
export function costTone(ratio: number | null, kind: Product["kind"]) {
  if (ratio === null) return "neutral" as const
  const [good, warn] = kind === "retail" ? [0.75, 0.9] : [0.35, 0.45]
  if (ratio <= good) return "success" as const
  if (ratio <= warn) return "warning" as const
  return "danger" as const
}

/** "1.5" stays 1.5 and "200" stays 200: quantities keep up to three decimals. */
export function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(
    quantity
  )
}
