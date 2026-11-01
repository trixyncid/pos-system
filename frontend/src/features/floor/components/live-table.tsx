import { motion } from "motion/react"
import { useTranslation } from "react-i18next"

import {
  minutesSince,
  statusStyle,
  stayTone,
  TYPICAL_STAY_MINUTES,
} from "@/features/floor/lib/status.ts"
import { CANVAS, type FloorTable } from "@/features/floor/schemas/floor.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"
import { numberFormat } from "@/lib/locale-format.ts"

const pct = (value: number, of: number) => `${(value / of) * 100}%`

const compact = numberFormat({
  notation: "compact",
  maximumFractionDigits: 1,
})

/**
 * One table on the live floor. Placed and sized in percent of the area's
 * 1000×700 canvas, so the plan scales with the screen without measuring it;
 * text sizes use container units for the same reason. Busy tables are solid
 * blocks in their status colour with the status icon; free ones are outlines.
 */
export function LiveTable({
  table,
  now,
  dimmed,
  onOpen,
}: {
  table: FloorTable
  now: Date
  /** Faded back while the floor is filtered to another status. */
  dimmed: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const style = statusStyle[table.status]
  const Icon = style.icon
  const minutes = minutesSince(table.seated_at, now)
  const progress =
    minutes === null ? 0 : Math.min(100, (minutes / TYPICAL_STAY_MINUTES) * 100)
  const round = table.shape === "round"
  const radius = round ? "50%" : "16%"

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={`${t("floor.table", { label: table.label })}, ${t(`floor.status.${table.status}`)}`}
      whileTap={{ scale: 0.94 }}
      animate={{ opacity: dimmed ? 0.22 : 1 }}
      transition={spring.press}
      className={cn(
        "absolute outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        dimmed && "grayscale"
      )}
      style={{
        left: pct(table.x - table.width / 2, CANVAS.width),
        top: pct(table.y - table.height / 2, CANVAS.height),
        width: pct(table.width, CANVAS.width),
        height: pct(table.height, CANVAS.height),
        rotate: `${table.rotation}deg`,
        borderRadius: radius,
      }}
    >
      {/* The table top: colours ease between statuses instead of snapping. */}
      <span
        className={cn(
          "absolute inset-0 border-2 transition-[background,border-color] duration-500",
          style.solid ? "shadow-(--shadow-raised)" : "shadow-(--shadow-soft)",
          table.status === "available" && "border-dashed"
        )}
        style={{
          background: style.fill,
          borderColor: style.edge,
          borderRadius: radius,
        }}
      />
      {/* How long the guests have been seated: a ring outside the table that fills over a typical meal. */}
      {minutes !== null && (
        <svg
          className="absolute -inset-[7%] size-[114%] overflow-visible"
          style={round ? { rotate: "-90deg" } : undefined}
          aria-hidden
        >
          {round ? (
            <circle
              cx="50%"
              cy="50%"
              r="47%"
              pathLength={100}
              fill="none"
              strokeWidth={3.5}
              strokeLinecap="round"
              stroke={stayTone(minutes)}
              strokeDasharray={`${progress} 100`}
              style={{ color: style.swatch }}
            />
          ) : (
            <rect
              x="2%"
              y="2%"
              width="96%"
              height="96%"
              rx="17%"
              pathLength={100}
              fill="none"
              strokeWidth={3.5}
              strokeLinecap="round"
              stroke={stayTone(minutes)}
              strokeDasharray={`${progress} 100`}
              style={{ color: style.swatch }}
            />
          )}
        </svg>
      )}
      {/* Text stays upright on a rotated table. */}
      <span
        className="relative flex size-full flex-col items-center justify-center gap-[0.35cqw] leading-none"
        style={{ rotate: `${-table.rotation}deg`, color: style.ink }}
      >
        <span className="flex items-center gap-[0.5cqw]">
          <Icon className="size-[1.7cqw] shrink-0" aria-hidden />
          <span
            className={cn(
              "font-heading text-[2.7cqw] font-semibold",
              !style.solid && "text-foreground"
            )}
          >
            {table.label}
          </span>
        </span>
        {table.guests !== null ? (
          <span className="text-[1.25cqw] font-semibold tabular-nums">
            {table.guests}
            {minutes !== null && ` · ${t("floor.minutes", { count: minutes })}`}
          </span>
        ) : (
          <span className="text-[1.2cqw] font-medium">
            {t("floor.seats", { count: table.capacity })}
          </span>
        )}
        {table.status === "billed" && table.order_total !== null && (
          <span className="rounded-full bg-black/10 px-[0.6cqw] py-[0.2cqw] text-[1.15cqw] font-bold tabular-nums">
            Rp {compact.format(table.order_total)}
          </span>
        )}
      </span>
    </motion.button>
  )
}
