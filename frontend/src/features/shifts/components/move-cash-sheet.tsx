import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { MoneyInput } from "@/components/ui/money-input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { useMoveCash } from "@/features/shifts/api/shifts.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { cn } from "@/lib/utils.ts"

function Body({
  shiftId,
  kind,
  onDone,
}: {
  shiftId: string
  kind: "in" | "out"
  onDone: () => void
}) {
  const { t } = useTranslation()
  const move = useMoveCash()
  const reasons = t(kind === "in" ? "shifts.reasonsIn" : "shifts.reasonsOut", {
    returnObjects: true,
  }) as unknown as string[]
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      await move.mutateAsync({
        shiftId,
        kind,
        amount: Number(amount),
        reason,
      })
      toast.success(t("shifts.moved"))
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-heading font-semibold">{t("shifts.amount")}</h3>
        <MoneyInput
          value={amount}
          onChange={setAmount}
          className="h-14 rounded-2xl pl-11 font-heading text-2xl"
          prefixClassName="left-4 text-base"
        />
      </section>
      <section className="space-y-2">
        <h3 className="font-heading font-semibold">{t("shifts.reason")}</h3>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {reasons.map((text) => (
            <Pressable
              key={text}
              role="radio"
              aria-checked={reason === text}
              onClick={() => setReason(text)}
              className={cn(
                "h-11 rounded-xl border px-4 text-sm font-medium transition-colors",
                reason === text
                  ? "border-primary bg-primary/10 text-accent-foreground"
                  : "bg-background"
              )}
            >
              {text}
            </Pressable>
          ))}
        </div>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={120}
          placeholder={t("shifts.reason")}
          className="h-12 rounded-xl text-base"
        />
      </section>
      {error && (
        <p role="alert" className="text-center text-sm text-danger-ink">
          {error}
        </p>
      )}
      <Button
        size="xl"
        className="w-full"
        variant={kind === "out" ? "destructive" : "default"}
        disabled={!Number(amount) || !reason.trim() || move.isPending}
        onClick={() => void submit()}
      >
        {move.isPending && <Spinner />}
        {t("shifts.save")}
      </Button>
    </div>
  )
}

/** Cash into or out of the drawer mid-shift (float top-up, buying ice), always with a reason. */
export function MoveCashSheet({
  shiftId,
  kind,
  onClose,
}: {
  shiftId: string
  kind: "in" | "out" | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={kind !== null}
      onOpenChange={(open) => !open && onClose()}
      side="center"
      title={
        kind === "out" ? t("shifts.moveTitleOut") : t("shifts.moveTitleIn")
      }
      description={t("shifts.moveBody")}
    >
      {kind && (
        <Body key={kind} shiftId={shiftId} kind={kind} onDone={onClose} />
      )}
    </TouchSheet>
  )
}
