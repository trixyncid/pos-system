import { useNavigate } from "@tanstack/react-router"
import { motion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Pressable } from "@/components/motion/pressable.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { useAreasQuery } from "@/features/floor/api/floor.ts"
import { LiveTable } from "@/features/floor/components/live-table.tsx"
import { statusOrder, statusStyle } from "@/features/floor/lib/status.ts"
import {
  CANVAS,
  type FloorTable,
  type TableStatus,
} from "@/features/floor/schemas/floor.ts"
import { OpenTableSheet } from "@/features/ordering/components/open-table-sheet.tsx"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { spring } from "@/lib/motion.ts"
import { useNow } from "@/lib/use-now.ts"
import { cn } from "@/lib/utils.ts"

const busy = new Set(["occupied", "ordered", "billed"])

/**
 * The waiter's home screen: every table, coloured by status, with a ring
 * showing how long guests have been seated. Tap a table for its actions.
 */
export function FloorPage() {
  const { t } = useTranslation()
  const areas = useAreasQuery({ live: true })
  const now = useNow(30_000)
  const [areaId, setAreaId] = useState<string | null>(null)
  const [opening, setOpening] = useState<FloorTable | null>(null)
  // Tapping a status counter highlights those tables and fades the rest.
  const [focus, setFocus] = useState<TableStatus | null>(null)
  const navigate = useNavigate()

  // Busy tables go straight to their order; free ones ask for the guest count.
  const tap = (table: FloorTable) => {
    if (table.order_id)
      void navigate({
        to: "/order/$orderId",
        params: { orderId: table.order_id },
      })
    else setOpening(table)
  }

  if (areas.isPending)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-12 w-80 rounded-2xl" />
        <Skeleton className="aspect-10/7 rounded-3xl" />
      </div>
    )
  if (areas.isError)
    return <p className="p-6 text-danger-ink">{apiErrorMessage(areas.error)}</p>
  if (areas.data.length === 0)
    return (
      <p className="p-10 text-center text-muted-foreground">
        {t("floor.noAreas")}
      </p>
    )

  const area = areas.data.find((item) => item.id === areaId) ?? areas.data[0]!
  const counts = Object.fromEntries(
    statusOrder.map((status) => [
      status,
      area.tables.filter((item) => item.status === status).length,
    ])
  )

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label={t("floor.title")}
          className="flex gap-1 rounded-2xl bg-muted p-1"
        >
          {areas.data.map((item) => {
            const active = item.id === area.id
            const seated = item.tables.filter((row) =>
              busy.has(row.status)
            ).length
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setAreaId(item.id)}
                className={cn(
                  "relative flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="floor-area"
                    transition={spring.layout}
                    className="absolute inset-0 rounded-xl bg-background shadow-(--shadow-soft)"
                  />
                )}
                <span className="relative">{item.name}</span>
                <span className="relative rounded-full bg-primary/12 px-2 text-xs text-accent-foreground tabular-nums">
                  {seated}/{item.tables.length}
                </span>
              </button>
            )
          })}
        </div>
        <div
          role="group"
          aria-label={t("floor.legend")}
          className="flex flex-wrap gap-2"
        >
          {statusOrder.map((status) => {
            const style = statusStyle[status]
            const Icon = style.icon
            const on = focus === status
            return (
              <Pressable
                key={status}
                aria-pressed={on}
                onClick={() => setFocus(on ? null : status)}
                className={cn(
                  "flex h-12 items-center gap-2.5 rounded-2xl border-2 bg-card pr-3.5 pl-1.5 text-left transition-colors",
                  on ? "border-foreground/70" : "border-transparent",
                  focus && !on && "opacity-55"
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl",
                    status === "available" && "border-2 border-dashed"
                  )}
                  style={{
                    background: style.fill,
                    borderColor: style.edge,
                    color: style.ink,
                  }}
                >
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="leading-tight">
                  <span className="block font-heading text-lg font-semibold tabular-nums">
                    {counts[status]}
                  </span>
                  <span className="block text-xs whitespace-nowrap text-muted-foreground">
                    {t(`floor.status.${status}`)}
                  </span>
                </span>
              </Pressable>
            )
          })}
        </div>
      </div>

      {/* The plan keeps the canvas ratio and shrinks to whatever space the screen leaves. */}
      <div className="flex min-h-0 flex-1 items-start justify-center">
        <motion.div
          key={area.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.sheet}
          className="@container relative max-h-full w-full max-w-[min(100%,calc((100dvh-13rem)*10/7))] rounded-3xl border bg-card/50 shadow-(--shadow-soft)"
          style={{
            aspectRatio: `${CANVAS.width} / ${CANVAS.height}`,
            backgroundImage:
              "radial-gradient(circle, var(--border) 1px, transparent 1px)",
            backgroundSize: "2.5% calc(2.5% * 10 / 7)",
          }}
        >
          {area.tables.length === 0 ? (
            <p className="absolute inset-0 grid place-items-center text-muted-foreground">
              {t("floor.empty")}
            </p>
          ) : (
            area.tables.map((item) => (
              <LiveTable
                key={item.id}
                table={item}
                now={now}
                dimmed={focus !== null && item.status !== focus}
                onOpen={() => tap(item)}
              />
            ))
          )}
        </motion.div>
      </div>

      <OpenTableSheet table={opening} onClose={() => setOpening(null)} />
    </div>
  )
}
