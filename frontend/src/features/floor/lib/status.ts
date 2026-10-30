import type { StatusTone } from "@/components/pos/status-pill.tsx"
import type { TableStatus } from "@/features/floor/schemas/floor.ts"

export const statusOrder: readonly TableStatus[] = [
  "available",
  "occupied",
  "ordered",
  "billed",
  "cleaning",
]

/** Each status has a fill and an edge colour for the table, and a pill tone for lists. */
export const statusStyle: Record<
  TableStatus,
  { tone: StatusTone; fill: string; edge: string; ink: string }
> = {
  available: {
    tone: "success",
    fill: "color-mix(in oklch, var(--success) 12%, var(--card))",
    edge: "color-mix(in oklch, var(--success) 55%, transparent)",
    ink: "var(--success-ink)",
  },
  occupied: {
    tone: "info",
    fill: "color-mix(in oklch, var(--chart-3) 16%, var(--card))",
    edge: "color-mix(in oklch, var(--chart-3) 60%, transparent)",
    ink: "var(--chart-3)",
  },
  ordered: {
    tone: "accent",
    fill: "color-mix(in oklch, var(--primary) 20%, var(--card))",
    edge: "var(--primary)",
    ink: "var(--accent-foreground)",
  },
  billed: {
    tone: "warning",
    fill: "color-mix(in oklch, var(--warning) 22%, var(--card))",
    edge: "var(--warning)",
    ink: "var(--warning-ink)",
  },
  cleaning: {
    tone: "neutral",
    fill: "repeating-linear-gradient(135deg, var(--muted) 0 6px, var(--card) 6px 12px)",
    edge: "var(--border)",
    ink: "var(--muted-foreground)",
  },
}

/** A typical meal; the timer ring fills over this long, then turns red. */
export const TYPICAL_STAY_MINUTES = 90

export function minutesSince(iso: string | null, now: Date) {
  if (!iso) return null
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  )
}

export function stayTone(minutes: number) {
  if (minutes >= TYPICAL_STAY_MINUTES) return "var(--danger)"
  if (minutes >= TYPICAL_STAY_MINUTES * 0.75) return "var(--warning)"
  return "currentColor"
}
