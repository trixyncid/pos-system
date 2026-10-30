import {
  CircleCheckIcon,
  CookingPotIcon,
  type LucideIcon,
  ReceiptTextIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"

import type { StatusTone } from "@/components/pos/status-pill.tsx"
import type { TableStatus } from "@/features/floor/schemas/floor.ts"

export const statusOrder: readonly TableStatus[] = [
  "available",
  "occupied",
  "ordered",
  "billed",
  "cleaning",
]

/**
 * How each status looks on the plan. Busy tables (seated, ordered, bill
 * printed) are solid blocks in three hues that stay apart for colour-blind
 * staff; free tables are quiet outlines; cleaning is hatched. Every status
 * also has its own icon, so colour is never the only cue.
 */
export const statusStyle: Record<
  TableStatus,
  {
    tone: StatusTone
    fill: string
    edge: string
    /** Text and icons on the table. */
    ink: string
    /** The status colour itself, for legend dots and highlights. */
    swatch: string
    icon: LucideIcon
    solid: boolean
  }
> = {
  available: {
    tone: "success",
    fill: "var(--card)",
    edge: "color-mix(in oklch, var(--success) 70%, transparent)",
    ink: "var(--success-ink)",
    swatch: "var(--success)",
    icon: CircleCheckIcon,
    solid: false,
  },
  occupied: {
    tone: "info",
    fill: "var(--table-seated)",
    edge: "color-mix(in oklch, var(--table-seated) 70%, black)",
    ink: "var(--table-on-dark)",
    swatch: "var(--table-seated)",
    icon: UsersIcon,
    solid: true,
  },
  ordered: {
    tone: "accent",
    fill: "var(--table-ordered)",
    edge: "color-mix(in oklch, var(--table-ordered) 70%, black)",
    ink: "var(--table-on-dark)",
    swatch: "var(--table-ordered)",
    icon: CookingPotIcon,
    solid: true,
  },
  billed: {
    tone: "warning",
    fill: "var(--table-billed)",
    edge: "color-mix(in oklch, var(--table-billed) 70%, black)",
    ink: "var(--table-on-light)",
    swatch: "var(--table-billed)",
    icon: ReceiptTextIcon,
    solid: true,
  },
  cleaning: {
    tone: "neutral",
    fill: "repeating-linear-gradient(135deg, var(--muted) 0 6px, var(--card) 6px 12px)",
    edge: "var(--border)",
    ink: "var(--muted-foreground)",
    swatch: "var(--muted-foreground)",
    icon: SparklesIcon,
    solid: false,
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
