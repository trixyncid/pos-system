import type { TFunction } from "i18next"

import type { StatusTone } from "@/components/pos/status-pill.tsx"
import type { Order } from "@/features/ordering/schemas/order.ts"

/** "Meja 7", "Snack bar #12" or "Bawa pulang #12". */
export function orderLabel(
  order: Pick<Order, "channel" | "table_label" | "number">,
  t: TFunction
) {
  if (order.channel === "snackbar")
    return t("history.snackbarNumber", { number: order.number })
  if (order.table_label) return t("order.table", { label: order.table_label })
  return t("order.takeaway", { number: order.number })
}

export const statusTone: Record<Order["status"], StatusTone> = {
  open: "info",
  billed: "warning",
  paid: "success",
  merged: "neutral",
  void: "neutral",
  refunded: "danger",
}
