import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { NumPad } from "@/components/pos/num-pad.tsx"
import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { PinDots } from "@/features/auth/components/pin-dots.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import {
  useApproversQuery,
  useVoidLine,
} from "@/features/ordering/api/orders.ts"
import type { OrderLine } from "@/features/ordering/schemas/order.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { cn } from "@/lib/utils.ts"

function Body({
  orderId,
  line,
  onDone,
}: {
  orderId: string
  line: OrderLine
  onDone: () => void
}) {
  const { t } = useTranslation()
  const canVoid = useCan(perm.voidSentItem)
  const needsApproval = line.status === "sent" && !canVoid
  const approvers = useApproversQuery(needsApproval)
  const voidLine = useVoidLine()
  const reasons = t("order.reasons", {
    returnObjects: true,
  }) as unknown as string[]
  const [reason, setReason] = useState("")
  const [approver, setApprover] = useState<number | null>(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const submit = async () => {
    setError(null)
    try {
      await voidLine.mutateAsync({
        orderId,
        lineId: line.id,
        reason,
        ...(needsApproval && approver !== null
          ? { approver, approver_pin: pin }
          : {}),
      })
      toast.success(t("order.voided", { name: line.name }))
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
      setAttempt((n) => n + 1)
      setPin("")
    }
  }

  const ready =
    reason.trim() && (!needsApproval || (approver !== null && pin.length >= 4))

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-heading font-semibold">{t("order.reason")}</h3>
        <div className="flex flex-wrap gap-2">
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
          placeholder={t("order.reason")}
          className="h-12 rounded-xl text-base"
        />
      </section>

      {needsApproval && (
        <section className="space-y-3">
          <div>
            <h3 className="font-heading font-semibold">
              {t("order.approval")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("order.approvalBody")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {approvers.data?.map((person) => (
              <Pressable
                key={person.id}
                role="radio"
                aria-checked={approver === person.id}
                onClick={() => {
                  setApprover(person.id)
                  setPin("")
                  setError(null)
                }}
                className={cn(
                  "flex h-14 items-center gap-2 rounded-2xl border pr-4 pl-2 text-sm font-medium transition-colors",
                  approver === person.id
                    ? "border-primary bg-primary/10"
                    : "bg-background"
                )}
              >
                <StaffAvatar name={person.full_name} size="sm" />
                {person.full_name}
              </Pressable>
            ))}
          </div>
          {approver !== null && (
            <div className="mx-auto max-w-xs space-y-3 pt-2">
              <PinDots
                length={Math.max(4, pin.length)}
                filled={pin.length}
                error={Boolean(error)}
                attempt={attempt}
              />
              <NumPad
                keyboard
                deleteLabel={t("auth.deleteDigit")}
                onDigit={(digit) =>
                  setPin((value) => (value.length >= 6 ? value : value + digit))
                }
                onBackspace={() => setPin((value) => value.slice(0, -1))}
              />
            </div>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-danger-ink">
          {error}
        </p>
      )}

      <Button
        size="xl"
        variant="destructive"
        className="w-full"
        disabled={!ready || voidLine.isPending}
        onClick={() => void submit()}
      >
        {voidLine.isPending && <Spinner />}
        {needsApproval ? t("order.approve") : t("order.swipeVoid")}
      </Button>
    </div>
  )
}

/** Void a line the kitchen already has: a reason always, a manager's PIN when the user can't void alone. */
export function VoidSheet({
  orderId,
  line,
  onClose,
}: {
  orderId: string
  line: OrderLine | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={line !== null}
      onOpenChange={(open) => !open && onClose()}
      side="right"
      title={
        line
          ? t("order.voidTitle", { name: `${line.quantity}× ${line.name}` })
          : ""
      }
      description={t("order.voidBody")}
      className="w-[min(560px,calc(100vw-1rem))]"
    >
      {line && (
        <Body key={line.id} orderId={orderId} line={line} onDone={onClose} />
      )}
    </TouchSheet>
  )
}
