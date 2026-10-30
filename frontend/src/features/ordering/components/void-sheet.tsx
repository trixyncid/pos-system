import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { useVoidLine } from "@/features/ordering/api/orders.ts"
import {
  type Approval,
  ApprovalPanel,
  approvalBody,
  approvalReady,
  noApproval,
} from "@/features/ordering/components/approval-panel.tsx"
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
  const voidLine = useVoidLine()
  const reasons = t("order.reasons", {
    returnObjects: true,
  }) as unknown as string[]
  const [reason, setReason] = useState("")
  const [approval, setApproval] = useState<Approval>(noApproval)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const submit = async () => {
    setError(null)
    try {
      await voidLine.mutateAsync({
        orderId,
        lineId: line.id,
        reason,
        ...(needsApproval ? approvalBody(approval) : {}),
      })
      toast.success(t("order.voided", { name: line.name }))
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
      setAttempt((n) => n + 1)
      setApproval((value) => ({ ...value, pin: "" }))
    }
  }

  const ready = reason.trim() && (!needsApproval || approvalReady(approval))

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
        <ApprovalPanel
          value={approval}
          onChange={(value) => {
            setApproval(value)
            setError(null)
          }}
          error={Boolean(error)}
          attempt={attempt}
        />
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
