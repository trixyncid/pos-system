import {
  ArrowRightLeftIcon,
  CombineIcon,
  PrinterIcon,
  SparklesIcon,
  UtensilsIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { useCleanTable } from "@/features/floor/api/floor.ts"
import { minutesSince, statusStyle } from "@/features/floor/lib/status.ts"
import type { FloorTable } from "@/features/floor/schemas/floor.ts"
import { useNow } from "@/lib/use-now.ts"

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-muted/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-heading text-lg font-semibold tabular-nums">
        {children}
      </p>
    </div>
  )
}

/** Quick actions for a tapped table. Order actions arrive with the order screen (M5). */
export function TableSheet({
  table,
  areaName,
  onClose,
}: {
  table: FloorTable | null
  areaName: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const now = useNow()
  const clean = useCleanTable()
  const minutes = table ? minutesSince(table.seated_at, now) : null
  const busy =
    table !== null && ["occupied", "ordered", "billed"].includes(table.status)

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
          <StatusPill tone={statusStyle[table.status].tone} pulse={busy}>
            {t(`floor.status.${table.status}`)}
          </StatusPill>
          {busy && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label={t("floor.guestsLabel")}>{table.guests ?? "–"}</Fact>
              <Fact label={t("floor.seatedLabel")}>
                {minutes !== null
                  ? t("floor.minutes", { count: minutes })
                  : "–"}
              </Fact>
              <Fact label={t("floor.waiter")}>{table.waiter ?? "–"}</Fact>
              <Fact label={t("floor.total")}>
                {table.order_total !== null ? (
                  <MoneyText amount={table.order_total} />
                ) : (
                  "–"
                )}
              </Fact>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {table.status === "cleaning" ? (
              <Button
                size="xl"
                className="sm:col-span-2"
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
            ) : (
              <Button
                size="xl"
                className="sm:col-span-2"
                disabled
                title={t("floor.comingInM5")}
              >
                <UtensilsIcon />
                {busy ? t("floor.continueOrder") : t("floor.openOrder")}
              </Button>
            )}
            {busy && (
              <>
                <Button size="touch" variant="secondary" disabled>
                  <ArrowRightLeftIcon />
                  {t("floor.moveTable")}
                </Button>
                <Button size="touch" variant="secondary" disabled>
                  <CombineIcon />
                  {t("floor.mergeTables")}
                </Button>
                <Button
                  size="touch"
                  variant="secondary"
                  className="sm:col-span-2"
                  disabled
                >
                  <PrinterIcon />
                  {t("floor.printBill")}
                </Button>
              </>
            )}
          </div>
          {table.status !== "cleaning" && (
            <p className="text-center text-sm text-muted-foreground">
              {t("floor.comingInM5")}
            </p>
          )}
        </div>
      )}
    </TouchSheet>
  )
}
