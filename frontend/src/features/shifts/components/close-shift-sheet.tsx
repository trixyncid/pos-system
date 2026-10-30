import { AlertTriangleIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { CountUp } from "@/components/motion/count-up.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { MoneyInput } from "@/components/ui/money-input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { useOpenOrdersQuery } from "@/features/ordering/api/orders.ts"
import { useCloseShift } from "@/features/shifts/api/shifts.ts"
import {
  CashCount,
  countTotal,
  emptyCount,
  type Count,
} from "@/features/shifts/components/cash-count.tsx"
import { signedIDR, varianceTone } from "@/features/shifts/lib/variance.ts"
import type { Shift } from "@/features/shifts/schemas/shift.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { cn } from "@/lib/utils.ts"

function Body({ shift, onDone }: { shift: Shift; onDone: () => void }) {
  const { t } = useTranslation()
  const close = useCloseShift()
  const canSeeOrders = useCan(perm.takeOrder)
  const open = useOpenOrdersQuery(canSeeOrders)
  const unpaid = open.data?.filter((o) => o.status === "billed").length ?? 0
  const [mode, setMode] = useState<"count" | "total">("count")
  const [count, setCount] = useState<Count>(emptyCount)
  const [total, setTotal] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const counted = mode === "count" ? countTotal(count) : Number(total || 0)
  const expected = shift.totals.expected_cash
  const variance = counted - expected
  const tone = varianceTone(variance)
  const touched = mode === "count" ? counted > 0 : total !== ""

  const submit = async () => {
    setError(null)
    try {
      await close.mutateAsync({
        shiftId: shift.id,
        counted_cash: counted,
        note,
      })
      toast.success(t("shifts.closed"))
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-5">
      {unpaid > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-warning/15 p-3 text-sm text-warning-ink">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          {t("shifts.unpaidWarn", { count: unpaid })}
        </p>
      )}
      <Segmented
        label={t("shifts.counted")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "count", label: t("shifts.byCount") },
          { value: "total", label: t("shifts.byTotal") },
        ]}
        className="w-full"
      />
      {mode === "count" ? (
        <CashCount value={count} onChange={setCount} />
      ) : (
        <MoneyInput
          value={total}
          onChange={setTotal}
          className="h-14 rounded-2xl pl-11 font-heading text-2xl"
          prefixClassName="left-4 text-base"
        />
      )}

      <div className="space-y-2 rounded-2xl bg-muted/60 p-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("shifts.expected")}</span>
          <MoneyText amount={expected} />
        </div>
        <div className="flex justify-between font-medium">
          <span>{t("shifts.counted")}</span>
          <MoneyText amount={counted} animate />
        </div>
        <div
          className={cn(
            "flex items-baseline justify-between font-heading text-xl font-semibold transition-colors",
            !touched && "text-muted-foreground",
            touched && tone === "success" && "text-success-ink",
            touched && tone === "warning" && "text-warning-ink",
            touched && tone === "danger" && "text-danger-ink"
          )}
        >
          <span>
            {t("shifts.variance")}
            {touched && (
              <span className="ml-2 text-sm font-medium">
                ·{" "}
                {variance === 0
                  ? t("shifts.balanced")
                  : variance > 0
                    ? t("shifts.over")
                    : t("shifts.under")}
              </span>
            )}
          </span>
          <CountUp
            value={touched ? variance : 0}
            format={signedIDR}
            className="tabular-nums"
          />
        </div>
      </div>

      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={200}
        placeholder={t("shifts.notePlaceholder")}
        aria-label={t("shifts.note")}
        className="min-h-20 rounded-xl text-base"
      />
      {error && (
        <p role="alert" className="text-center text-sm text-danger-ink">
          {error}
        </p>
      )}
      <Button
        size="xl"
        className="w-full"
        disabled={!touched || close.isPending}
        onClick={() => void submit()}
      >
        {close.isPending && <Spinner />}
        {t("shifts.closeConfirm")}
      </Button>
    </div>
  )
}

/** Close the drawer: count it, see the difference live, then print the shift report. */
export function CloseShiftSheet({
  shift,
  open,
  onClose,
}: {
  shift: Shift
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      side="center"
      title={t("shifts.closeTitle")}
      description={t("shifts.closeBody")}
      className="w-[min(560px,calc(100vw-1rem))]"
    >
      {open && <Body shift={shift} onDone={onClose} />}
    </TouchSheet>
  )
}
