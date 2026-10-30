import type { TFunction } from "i18next"

import type { Order } from "@/features/ordering/schemas/order.ts"

/** The bill's one discount line: "Promo Happy hour", "Diskon 10%" or "Diskon". */
export function discountLabel(order: Order, t: TFunction) {
  if (order.promo_name)
    return t("checkout.promoLine", { name: order.promo_name })
  if (order.discount_kind === "percent")
    return t("checkout.discountPercent", { value: order.discount_value })
  return t("checkout.discount")
}
