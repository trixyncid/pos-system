/**
 * Rupiah amounts are whole integers everywhere: in state, in the API and on
 * receipts. Percentages are applied here once and rounded half-up, so the
 * tablet and the server always agree on the total.
 */

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** "Rp 25.000" */
export function formatIDR(amount: number) {
  // Intl puts a no-break space after "Rp"; a plain space wraps the same everywhere.
  return idr.format(amount).replace(/\u00a0/g, " ")
}

/** `amount * percent / 100`, rounded half-up to a whole rupiah. */
export function percentOf(amount: number, percent: number) {
  return Math.round((amount * percent) / 100)
}

/** Cash total rounded to the nearest `unit` (Rp100 or Rp500), halves rounding up. */
export function roundCash(amount: number, unit: number) {
  if (unit <= 1) return amount
  return Math.round(amount / unit) * unit
}

export type TaxBase = "subtotal" | "subtotal_with_service"

export type BillRules = {
  servicePercent: number
  /** PBJT, the regional restaurant tax (at most 10%). */
  pbjtPercent: number
  /** Whether PBJT is charged on the subtotal alone or on subtotal plus service charge. */
  taxBase: TaxBase
  /** Cash rounding unit: 1 (none), 100 or 500. */
  rounding: number
}

/** `amount * part / whole`, rounded half-up: a proportional slice. */
export function shareOf(amount: number, part: number, whole: number) {
  return whole ? Math.round((amount * part) / whole) : 0
}

export type BillOptions = {
  /** False for counter sales: no table service. */
  service?: boolean
  /** The part of the subtotal PBJT applies to (PBJT-category lines); default all of it. */
  taxable?: number
}

/**
 * The bill, in the order every receipt shows it: subtotal, discount,
 * service charge, PBJT, rounding. The backend computes the same way
 * (payments/billing.compute).
 */
export function billTotals(
  subtotal: number,
  discount: number,
  rules: BillRules,
  { service = true, taxable }: BillOptions = {}
) {
  const afterDiscount = Math.max(0, subtotal - discount)
  const serviceCharge = service
    ? percentOf(afterDiscount, rules.servicePercent)
    : 0
  let base =
    rules.taxBase === "subtotal_with_service"
      ? afterDiscount + serviceCharge
      : afterDiscount
  if (taxable !== undefined && taxable < subtotal)
    base = shareOf(base, taxable, subtotal)
  const tax = percentOf(base, rules.pbjtPercent)
  const beforeRounding = afterDiscount + serviceCharge + tax
  const total = roundCash(beforeRounding, rules.rounding)
  return {
    subtotal,
    discount: subtotal - afterDiscount,
    service: serviceCharge,
    tax,
    rounding: total - beforeRounding,
    total,
  }
}

export type DiscountKind = "none" | "percent" | "amount"

/** The rupiah a discount takes off (backend payments/billing.order_discount). */
export function discountAmount(
  kind: DiscountKind,
  value: number,
  subtotal: number
) {
  if (kind === "percent") return Math.min(subtotal, percentOf(subtotal, value))
  if (kind === "amount") return Math.min(subtotal, value)
  return 0
}

/**
 * What some lines of a bill cost on their own, with their share of the
 * order's discount (backend payments/billing.lines_bill). Used to pay by item.
 */
export function shareTotals(
  part: number,
  subtotal: number,
  discount: number,
  rules: BillRules,
  options: BillOptions = {}
) {
  return billTotals(part, shareOf(discount, part, subtotal), rules, options)
}

/** One guest's part of an even split, rounded up to the cash unit so the last guest pays the least. */
export function evenPart(remaining: number, parts: number, unit: number) {
  if (parts <= 1) return remaining
  const step = Math.max(1, unit)
  return Math.min(remaining, Math.ceil(remaining / parts / step) * step)
}

const notes = [10_000, 20_000, 50_000, 100_000] as const

/**
 * Cash buttons for an amount due: the exact amount, then what guests
 * usually hand over (the next 10k, 20k, 50k, 100k up), at most four.
 */
export function quickCash(due: number) {
  const amounts = new Set<number>([due])
  for (const note of notes) {
    const next = Math.ceil(due / note) * note
    if (next > due) amounts.add(next)
  }
  if (amounts.size < 4)
    amounts.add(Math.ceil(due / 100_000) * 100_000 + 100_000)
  return [...amounts].sort((a, b) => a - b).slice(0, 4)
}
