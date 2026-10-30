import { useOutletQuery } from "@/features/outlet/hooks/use-outlet.ts"
import type { BillRules } from "@/lib/money.ts"

const none: BillRules = {
  servicePercent: 0,
  pbjtPercent: 0,
  taxBase: "subtotal",
  rounding: 1,
}

/** The outlet's service, PBJT and rounding rules, for previews the tablet computes itself. */
export function useBillRules(): BillRules {
  const outlet = useOutletQuery()
  if (!outlet.data) return none
  return {
    servicePercent: outlet.data.service_percent,
    pbjtPercent: outlet.data.pbjt_percent,
    taxBase: outlet.data.tax_base,
    rounding: outlet.data.cash_rounding,
  }
}
