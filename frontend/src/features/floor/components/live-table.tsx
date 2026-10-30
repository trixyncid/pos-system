import { UsersIcon } from "lucide-react"
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

const pct = (value: number, of: number) => `${(value / of) * 100}%`

/**
 * One table on the live floor. Placed and sized in percent of the area's
 * 1000×700 canvas, so the plan scales with the screen without measuring it;
 * text sizes use container units for the same reason.
 */
export function LiveTable({
  table,
  now,
  onOpen,
}: {
  table: FloorTable
  now: Date
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const style = statusStyle[table.status]
  const minutes = minutesSince(table.seated_at, now)
  const progress =
    minutes === null ? 0 : Math.min(100, (minutes / TYPICAL_STAY_MINUTES) * 100)
  const round = table.shape === "round"

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={`${t("floor.table", { label: table.label })}, ${t(`floor.status.${table.status}`)}`}
      whileTap={{ scale: 0.94 }}
      transition={spring.press}
      className="absolute outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      style={{
        left: pct(table.x - table.width / 2, CANVAS.width),
        top: pct(table.y - table.height / 2, CANVAS.height),
        width: pct(table.width, CANVAS.width),
        height: pct(table.height, CANVAS.height),
        rotate: `${table.rotation}deg`,
        borderRadius: round ? "50%" : "14%",
      }}
    >
      {/* The table top: colours ease between statuses instead of snapping. */}
      <span
        className="absolute inset-0 border-2 shadow-(--shadow-soft) transition-[background,border-color] duration-500"
        style={{
          background: style.fill,
          borderColor: style.edge,
          borderRadius: round ? "50%" : "14%",
        }}
      />
      {/* How long the guests have been seated, as a ring that fills over a typical meal. */}
      {minutes !== null && (
        <svg
          className="absolute -inset-[6%] size-[112%] overflow-visible"
          // The ring starts at 12 o'clock.
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
              strokeWidth={4}
              strokeLinecap="round"
              stroke={stayTone(minutes)}
              strokeDasharray={`${progress} 100`}
              style={{ color: style.edge }}
            />
          ) : (
            <rect
              x="2%"
              y="2%"
              width="96%"
              height="96%"
              rx="16%"
              pathLength={100}
              fill="none"
              strokeWidth={4}
              strokeLinecap="round"
              stroke={stayTone(minutes)}
              strokeDasharray={`${progress} 100`}
              style={{ color: style.edge }}
            />
          )}
        </svg>
      )}
      {/* Text stays upright on a rotated table. */}
      <span
        className="relative flex size-full flex-col items-center justify-center leading-none"
        style={{ rotate: `${-table.rotation}deg`, color: style.ink }}
      >
        <span className="font-heading text-[2.6cqw] font-semibold text-foreground">
          {table.label}
        </span>
        {table.guests !== null ? (
          <span className="mt-[0.4cqw] flex items-center gap-[0.3cqw] text-[1.3cqw] font-medium">
            <UsersIcon className="size-[1.3cqw]" />
            {table.guests}
            {minutes !== null && (
              <span className="tabular-nums">
                · {t("floor.minutes", { count: minutes })}
              </span>
            )}
          </span>
        ) : (
          <span className="mt-[0.4cqw] text-[1.2cqw]">
            {t("floor.seats", { count: table.capacity })}
          </span>
        )}
      </span>
    </motion.button>
  )
}
