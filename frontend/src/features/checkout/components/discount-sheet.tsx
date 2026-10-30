import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { MoneyInput } from "@/components/ui/money-input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { useSetDiscount } from "@/features/checkout/api/checkout.ts"
import {
  type Approval,
  ApprovalPanel,
  approvalBody,
  approvalReady,
  noApproval,
} from "@/features/ordering/components/approval-panel.tsx"
import type { Order } from "@/features/ordering/schemas/order.ts"
import { useBillRules } from "@/features/outlet/hooks/use-bill-rules.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { billTotals, discountAmount } from "@/lib/money.ts"
import { cn } from "@/lib/utils.ts"

const PRESETS = [5, 10, 15, 20, 25, 50] as const

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Pressable
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "h-12 min-w-16 rounded-xl border px-4 font-medium tabular-nums transition-colors",
        on
          ? "border-primary bg-primary/10 text-accent-foreground"
          : "bg-background"
      )}
    >
      {children}
    </Pressable>
  )
}

function Body({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useTranslation()
  const rules = useBillRules()
  const canDiscount = useCan(perm.applyDiscount)
  const setDiscount = useSetDiscount()
  const reasons = t("discount.reasons", {
    returnObjects: true,
  }) as unknown as string[]
  const [kind, setKind] = useState<"percent" | "amount">(
    order.discount_kind === "amount" ? "amount" : "percent"
  )
  const [percent, setPercent] = useState(
    order.discount_kind === "percent" ? order.discount_value : 10
  )
  const [amount, setAmount] = useState(
    order.discount_kind === "amount" ? String(order.discount_value) : ""
  )
  const [reason, setReason] = useState(order.discount_reason)
  const [approval, setApproval] = useState<Approval>(noApproval)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const value = kind === "percent" ? percent : Number(amount || 0)
  const preview = billTotals(
    order.subtotal,
    discountAmount(kind, value, order.subtotal),
    rules
  )
  const locked = order.payments.length > 0
  const ready =
    !locked &&
    value > 0 &&
    reason.trim() &&
    (canDiscount || approvalReady(approval))

  const submit = async (remove = false) => {
    setError(null)
    try {
      await setDiscount.mutateAsync({
        orderId: order.id,
        kind: remove ? "none" : kind,
        value: remove ? 0 : value,
        reason: remove ? "" : reason,
        ...(canDiscount ? {} : approvalBody(approval)),
      })
      toast.success(t(remove ? "discount.removed" : "discount.applied"))
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
      setAttempt((n) => n + 1)
      setApproval((current) => ({ ...current, pin: "" }))
    }
  }

  if (locked)
    return (
      <p className="rounded-2xl bg-warning/15 p-4 text-sm text-warning-ink">
        {t("discount.lockedPaid")}
      </p>
    )

  return (
    <div className="space-y-6">
      <Segmented
        label={t("discount.kind")}
        value={kind}
        onChange={setKind}
        options={[
          { value: "percent", label: t("discount.percent") },
          { value: "amount", label: t("discount.amount") },
        ]}
        className="w-full"
      />

      {kind === "percent" ? (
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Chip
              key={preset}
              on={percent === preset}
              onClick={() => setPercent(preset)}
            >
              {preset}%
            </Chip>
          ))}
        </div>
      ) : (
        <MoneyInput
          value={amount}
          onChange={setAmount}
          className="h-14 rounded-2xl pl-11 font-heading text-2xl"
          prefixClassName="left-4 text-base"
        />
      )}

      <section className="space-y-2">
        <h3 className="font-heading font-semibold">{t("discount.reason")}</h3>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {reasons.map((text) => (
            <Chip
              key={text}
              on={reason === text}
              onClick={() => setReason(text)}
            >
              {text}
            </Chip>
          ))}
        </div>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={120}
          placeholder={t("discount.reason")}
          className="h-12 rounded-xl text-base"
        />
      </section>

      <div className="flex items-baseline justify-between rounded-2xl bg-muted/60 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {t("discount.preview")}
        </span>
        <span className="flex items-baseline gap-2">
          {preview.discount > 0 && (
            <MoneyText
              amount={order.bill.total}
              className="text-sm text-muted-foreground line-through"
            />
          )}
          <MoneyText
            amount={preview.total}
            animate
            className="font-heading text-2xl font-semibold"
          />
        </span>
      </div>

      {!canDiscount && (
        <ApprovalPanel
          value={approval}
          onChange={(next) => {
            setApproval(next)
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

      <div className="flex gap-3">
        {order.discount_kind !== "none" && (
          <Button
            size="xl"
            variant="secondary"
            disabled={setDiscount.isPending}
            onClick={() => void submit(true)}
          >
            {t("discount.remove")}
          </Button>
        )}
        <Button
          size="xl"
          className="flex-1"
          disabled={!ready || setDiscount.isPending}
          onClick={() => void submit()}
        >
          {setDiscount.isPending && <Spinner />}
          {canDiscount ? t("discount.apply") : t("discount.approve")}
        </Button>
      </div>
    </div>
  )
}

/** A bill discount, percent or amount, always with a reason; a manager approves when the user can't. */
export function DiscountSheet({
  order,
  open,
  onClose,
}: {
  order: Order
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      side="right"
      title={t("discount.title")}
      description={t("discount.body")}
      className="w-[min(560px,calc(100vw-1rem))]"
    >
      {open && <Body order={order} onDone={onClose} />}
    </TouchSheet>
  )
}
