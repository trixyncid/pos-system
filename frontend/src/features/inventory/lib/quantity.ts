import type { Unit } from "@/features/catalog/schemas/catalog.ts"

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 })

/**
 * Stock in a unit people read: grams over a kilo show as kg, millilitres
 * over a litre as L, so "12.500 g" reads "12,5 kg".
 */
export function formatQuantity(quantity: number, unit: Unit) {
  const big = Math.abs(quantity) >= 1_000
  if (unit === "g" && big) return `${number.format(quantity / 1_000)} kg`
  if (unit === "ml" && big) return `${number.format(quantity / 1_000)} L`
  const label = unit === "portion" ? "porsi" : unit
  return `${number.format(quantity)} ${label}`
}

/** A signed change for the ledger: "+2 pcs", "−300 g". */
export function formatChange(quantity: number, unit: Unit) {
  const sign = quantity > 0 ? "+" : quantity < 0 ? "−" : ""
  return sign + formatQuantity(Math.abs(quantity), unit)
}

/** "1,5", "1.5" or "12" typed on a tablet keypad, as a number; NaN when it isn't one. */
export function parseQuantity(text: string) {
  const cleaned = text.trim().replace(",", ".")
  if (!/^\d+(\.\d{0,3})?$/.test(cleaned)) return Number.NaN
  return Number(cleaned)
}
