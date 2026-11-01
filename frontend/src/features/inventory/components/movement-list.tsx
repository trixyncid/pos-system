import { useTranslation } from "react-i18next"

import { StatusPill } from "@/components/pos/status-pill.tsx"
import {
  formatChange,
  formatQuantity,
} from "@/features/inventory/lib/quantity.ts"
import { kindTone } from "@/features/inventory/lib/tones.ts"
import type { Movement } from "@/features/inventory/schemas/inventory.ts"
import { cn } from "@/lib/utils.ts"
import { dateFormat } from "@/lib/locale-format.ts"

const when = dateFormat({
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

/** The ledger: each change, what it left on hand, who and why. */
export function MovementList({
  movements,
  showProduct = true,
}: {
  movements: Movement[]
  showProduct?: boolean
}) {
  const { t } = useTranslation()
  return (
    <ul className="divide-y rounded-2xl bg-card shadow-(--shadow-soft)">
      {movements.map((movement) => {
        const detail = [
          movement.order_number !== null && `#${movement.order_number}`,
          movement.reason,
          movement.by_name,
        ]
          .filter(Boolean)
          .join(" · ")
        return (
          <li key={movement.id} className="flex items-center gap-3 px-4 py-3">
            <StatusPill
              tone={kindTone[movement.kind]}
              className="w-24 justify-center"
            >
              {t(`inventory.kinds.${movement.kind}`)}
            </StatusPill>
            <div className="min-w-0 flex-1">
              {showProduct && (
                <p className="truncate font-medium">{movement.product_name}</p>
              )}
              <p className="truncate text-xs text-muted-foreground">
                {when.format(new Date(movement.created_at))}
                {detail && ` · ${detail}`}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "font-heading font-semibold tabular-nums",
                  movement.quantity < 0 ? "text-danger-ink" : "text-success-ink"
                )}
              >
                {formatChange(movement.quantity, movement.unit)}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("inventory.after", {
                  amount: formatQuantity(movement.balance, movement.unit),
                })}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
