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

/**
 * The bill, in the order every receipt shows it: subtotal, discount,
 * service charge, PBJT, rounding. The backend computes the same way.
 */
export function billTotals(
  subtotal: number,
  discount: number,
  rules: BillRules
) {
  const afterDiscount = Math.max(0, subtotal - discount)
  const service = percentOf(afterDiscount, rules.servicePercent)
  const taxable =
    rules.taxBase === "subtotal_with_service"
      ? afterDiscount + service
      : afterDiscount
  const tax = percentOf(taxable, rules.pbjtPercent)
  const beforeRounding = afterDiscount + service + tax
  const total = roundCash(beforeRounding, rules.rounding)
  return {
    subtotal,
    discount: subtotal - afterDiscount,
    service,
    tax,
    rounding: total - beforeRounding,
    total,
  }
}
