import { SparklesIcon, UtensilsIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { StatusPill } from "@/components/pos/status-pill.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { useCleanTable } from "@/features/floor/api/floor.ts"
import { statusStyle } from "@/features/floor/lib/status.ts"
import type { FloorTable } from "@/features/floor/schemas/floor.ts"

/**
 * A table waiting to be cleaned: mark it clean, or seat guests anyway
 * (opening an order clears the flag too).
 */
export function TableSheet({
  table,
  areaName,
  onOpenOrder,
  onClose,
}: {
  table: FloorTable | null
  areaName: string
  onOpenOrder: (table: FloorTable) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const clean = useCleanTable()

  return (
    <TouchSheet
      open={table !== null}
      onOpenChange={(open) => !open && onClose()}
      title={
        table ? `${t("floor.table", { label: table.label })} · ${areaName}` : ""
      }
      description={
        table ? t("floor.seats", { count: table.capacity }) : undefined
      }
    >
      {table && (
        <div className="space-y-5">
          <StatusPill tone={statusStyle[table.status].tone}>
            {t(`floor.status.${table.status}`)}
          </StatusPill>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              size="xl"
              disabled={clean.isPending}
              onClick={async () => {
                await clean.mutateAsync(table.id)
                toast.success(t("floor.cleaned", { label: table.label }))
                onClose()
              }}
            >
              <SparklesIcon />
              {t("floor.markClean")}
            </Button>
            <Button
              size="xl"
              variant="secondary"
              onClick={() => onOpenOrder(table)}
            >
              <UtensilsIcon />
              {t("floor.openOrder")}
            </Button>
          </div>
        </div>
      )}
    </TouchSheet>
  )
}
