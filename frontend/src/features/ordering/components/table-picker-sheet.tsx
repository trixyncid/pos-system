import { useTranslation } from "react-i18next"

import { Pressable } from "@/components/motion/pressable.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { useAreasQuery } from "@/features/floor/api/floor.ts"
import { statusStyle } from "@/features/floor/lib/status.ts"
import type { FloorTable } from "@/features/floor/schemas/floor.ts"

/**
 * Pick a table, grouped by area. "move" offers free tables; "merge" offers
 * other tables that have an open order.
 */
export function TablePickerSheet({
  mode,
  currentTableId,
  onPick,
  onClose,
}: {
  mode: "move" | "merge" | null
  currentTableId: string | null
  onPick: (table: FloorTable) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const areas = useAreasQuery()
  const eligible = (table: FloorTable) =>
    table.id !== currentTableId &&
    (mode === "move"
      ? table.order_id === null
      : table.order_id !== null && table.status !== "billed")

  return (
    <TouchSheet
      open={mode !== null}
      onOpenChange={(open) => !open && onClose()}
      title={mode === "merge" ? t("order.merge") : t("order.move")}
      description={
        mode === "merge" ? t("order.mergeBody") : t("order.moveBody")
      }
    >
      <div className="space-y-5">
        {areas.data?.map((area) => {
          const tables = area.tables.filter(eligible)
          if (!tables.length) return null
          return (
            <section key={area.id}>
              <h3 className="mb-2 font-heading font-semibold">{area.name}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
                {tables.map((table) => (
                  <Pressable
                    key={table.id}
                    onClick={() => onPick(table)}
                    className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-card"
                    style={{ borderColor: statusStyle[table.status].edge }}
                  >
                    <span className="font-heading text-2xl font-semibold">
                      {table.label}
                    </span>
                    <StatusPill tone={statusStyle[table.status].tone}>
                      {table.guests !== null
                        ? t("floor.guests", { count: table.guests })
                        : t("floor.seats", { count: table.capacity })}
                    </StatusPill>
                  </Pressable>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </TouchSheet>
  )
}
