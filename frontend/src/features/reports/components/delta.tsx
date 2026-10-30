import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { change } from "@/features/reports/lib/format.ts"
import { cn } from "@/lib/utils.ts"

/** "▲ 12% vs yesterday": an arrow and a sign as well as colour, so it reads without colour. */
export function Delta({
  now,
  before,
  label,
}: {
  now: number
  before: number
  label: string
}) {
  const percent = change(now, before)
  const Icon =
    percent === null || percent === 0
      ? MinusIcon
      : percent > 0
        ? TrendingUpIcon
        : TrendingDownIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
        percent === null || percent === 0
          ? "text-muted-foreground"
          : percent > 0
            ? "text-success-ink"
            : "text-danger-ink"
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {percent === null ? "—" : `${percent > 0 ? "+" : ""}${percent}%`}
      <span className="font-normal text-muted-foreground">{label}</span>
    </span>
  )
}
