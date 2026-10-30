import { motion } from "motion/react"

import type { StockStatus } from "@/features/inventory/schemas/inventory.ts"
import { cn } from "@/lib/utils.ts"

/**
 * How full the shelf is, against three times the low-stock mark (a
 * comfortable level). The colour says the same as the status pill.
 */
export function StockBar({
  stock,
  threshold,
  status,
}: {
  stock: number
  threshold: number | null
  status: StockStatus
}) {
  const full = Math.max((threshold ?? 5) * 3, 1)
  const ratio = Math.min(1, Math.max(0, stock / full))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        className={cn(
          "h-full origin-left rounded-full",
          status === "ok" && "bg-success",
          status === "low" && "bg-warning",
          status === "out" && "bg-danger"
        )}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: ratio }}
        transition={{ type: "spring", stiffness: 160, damping: 26 }}
      />
    </div>
  )
}
