import type { StatusTone } from "@/components/pos/status-pill.tsx"
import type {
  MovementKind,
  StockStatus,
} from "@/features/inventory/schemas/inventory.ts"

export const statusTone: Record<StockStatus, StatusTone> = {
  ok: "success",
  low: "warning",
  out: "danger",
}

export const kindTone: Record<MovementKind, StatusTone> = {
  sale: "neutral",
  void: "info",
  receive: "success",
  waste: "danger",
  count: "accent",
}
