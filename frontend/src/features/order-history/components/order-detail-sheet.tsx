import { useNavigate } from "@tanstack/react-router"
import {
  BanknoteIcon,
  PencilIcon,
  PrinterIcon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { discountLabel } from "@/features/checkout/lib/discount-label.ts"
import {
  useInvalidateHistory,
  useRefundOrder,
  useReprintOrder,
} from "@/features/order-history/api/history.ts"
import {
  orderLabel,
  statusTone,
} from "@/features/order-history/components/order-label.ts"
import {
  useCancelOrder,
  useOrderQuery,
} from "@/features/ordering/api/orders.ts"
import {
  type Approval,
  ApprovalPanel,
  approvalBody,
  approvalReady,
  noApproval,
} from "@/features/ordering/components/approval-panel.tsx"
import type { Order } from "@/features/ordering/schemas/order.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { formatIDR } from "@/lib/money.ts"
import { cn } from "@/lib/utils.ts"

const when = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function Row({
  label,
  children,
  strong,
}: {
  label: ReactNode
  children: ReactNode
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        strong
          ? "font-heading text-lg font-semibold"
          : "text-sm text-muted-foreground"
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  )
}

function Refund({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useTranslation()
  const canVoid = useCan(perm.voidSentItem)
  const refund = useRefundOrder()
  const reasons = t("history.refundReasons", {
    returnObjects: true,
  }) as unknown as string[]
  const [reason, setReason] = useState("")
  const [approval, setApproval] = useState<Approval>(noApproval)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const submit = async () => {
    setError(null)
    try {
      await refund.mutateAsync({
        orderId: order.id,
        reason,
        ...(canVoid ? {} : approvalBody(approval)),
      })
      toast.success(t("history.refunded", { amount: formatIDR(order.paid) }))
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
      setAttempt((n) => n + 1)
      setApproval((current) => ({ ...current, pin: "" }))
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border-2 border-danger/40 p-4">
      <div>
        <h3 className="font-heading font-semibold">
          {t("history.refundTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("history.refundBody", { amount: formatIDR(order.paid) })}
        </p>
      </div>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {reasons.map((text) => (
          <Pressable
            key={text}
            role="radio"
            aria-checked={reason === text}
            onClick={() => setReason(text)}
            className={cn(
              "h-11 rounded-xl border px-4 text-sm font-medium transition-colors",
              reason === text ? "border-primary bg-primary/10" : "bg-background"
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
        placeholder={t("history.refundReason")}
        className="h-12 rounded-xl text-base"
      />
      {!canVoid && (
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
      <Button
        size="xl"
        variant="destructive"
        className="w-full"
        disabled={
          !reason.trim() ||
          (!canVoid && !approvalReady(approval)) ||
          refund.isPending
        }
        onClick={() => void submit()}
      >
        {refund.isPending ? <Spinner /> : <RotateCcwIcon />}
        {t("history.refundConfirm", { amount: formatIDR(order.paid) })}
      </Button>
    </div>
  )
}

function Body({ order, onClose }: { order: Order; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const canPay = useCan(perm.takePayment)
  const canReprint = useCan(perm.reprint)
  const reprint = useReprintOrder()
  const cancel = useCancelOrder()
  const refreshList = useInvalidateHistory()
  const [refunding, setRefunding] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const seated = order.status === "open" || order.status === "billed"
  const lines = order.lines
  const nothingSent = !lines.some((l) => l.status === "sent")

  const print = async (kind: "bill" | "receipt") => {
    try {
      await reprint.mutateAsync({ orderId: order.id, kind })
      toast.success(
        t(
          kind === "bill" ? "history.billReprinted" : "history.receiptReprinted"
        )
      )
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <StatusPill tone={statusTone[order.status]}>
          {t(`history.status.${order.status}`)}
        </StatusPill>
        <span>
          {when.format(new Date(order.created_at))} · {order.waiter}
          {order.guests > 1 &&
            ` · ${t("order.guests", { count: order.guests })}`}
        </span>
        {order.closed_at && (
          <span>
            ·{" "}
            {t("history.closedAt", {
              time: when.format(new Date(order.closed_at)),
            })}
          </span>
        )}
      </div>

      {order.status === "refunded" && (
        <div className="rounded-2xl bg-danger/10 p-4 text-sm text-danger-ink">
          <p className="font-medium">
            {t("history.refundedNote", {
              time: order.refunded_at
                ? when.format(new Date(order.refunded_at))
                : "",
              by: order.refunded_by_name ?? "",
              approver: order.refund_approved_by_name ?? "",
            })}
          </p>
          <p>{order.refund_reason}</p>
        </div>
      )}

      <ul className="divide-y rounded-2xl bg-background">
        {lines.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">
            {t("history.noItems")}
          </li>
        )}
        {lines.map((line) => {
          const voided = line.status === "void"
          return (
            <li
              key={line.id}
              className={cn("flex gap-3 px-4 py-3", voided && "opacity-55")}
            >
              <span className="w-8 shrink-0 font-heading font-semibold tabular-nums">
                {line.quantity}×
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn("block font-medium", voided && "line-through")}
                >
                  {line.name}
                </span>
                {(line.modifiers.length > 0 || line.note) && (
                  <span className="block text-xs text-muted-foreground">
                    {[...line.modifiers.map((m) => m.name), line.note]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {voided && (
                  <span className="block text-xs text-danger-ink">
                    {t("history.voided", { reason: line.void_reason })}
                  </span>
                )}
                {line.status === "held" && (
                  <span className="block text-xs text-warning-ink">
                    {t("order.held")}
                  </span>
                )}
              </span>
              <MoneyText
                amount={line.total}
                className={cn("shrink-0", voided && "line-through")}
              />
            </li>
          )
        })}
      </ul>

      <div className="space-y-1 rounded-2xl bg-background p-4">
        <Row label={t("order.subtotal")}>{formatIDR(order.bill.subtotal)}</Row>
        {order.bill.discount > 0 && (
          <Row label={discountLabel(order, t)}>
            −{formatIDR(order.bill.discount)}
          </Row>
        )}
        {order.bill.service > 0 && (
          <Row label={t("history.service")}>
            {formatIDR(order.bill.service)}
          </Row>
        )}
        {order.bill.tax > 0 && (
          <Row label={t("history.tax")}>{formatIDR(order.bill.tax)}</Row>
        )}
        {order.bill.rounding !== 0 && (
          <Row label={t("order.rounding")}>
            {order.bill.rounding > 0 ? "+" : "−"}
            {formatIDR(Math.abs(order.bill.rounding))}
          </Row>
        )}
        <div className="pt-1">
          <Row label={t("order.total")} strong>
            {formatIDR(order.bill.total)}
          </Row>
        </div>
        {order.payments.map((payment) => (
          <Row
            key={payment.id}
            label={t("history.payment", {
              time: when.format(new Date(payment.created_at)),
              by: payment.received_by_name,
            })}
          >
            {payment.method === "qris" && (
              <span className="mr-1 text-xs">QRIS</span>
            )}
            {formatIDR(payment.amount)}
            {payment.change > 0 && (
              <span className="ml-1 text-xs">
                ({t("history.change", { amount: formatIDR(payment.change) })})
              </span>
            )}
          </Row>
        ))}
      </div>

      {refunding ? (
        <Refund order={order} onDone={() => setRefunding(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {seated && order.channel === "restaurant" && (
            <Button
              size="touch"
              variant="secondary"
              onClick={() => {
                onClose()
                void navigate({
                  to: "/order/$orderId",
                  params: { orderId: order.id },
                })
              }}
            >
              <PencilIcon />
              {t("history.edit")}
            </Button>
          )}
          {seated && canPay && lines.some((l) => l.status === "sent") && (
            <Button
              size="touch"
              onClick={() => {
                onClose()
                void navigate({
                  to: "/checkout/$orderId",
                  params: { orderId: order.id },
                })
              }}
            >
              <BanknoteIcon />
              {t("history.pay")}
            </Button>
          )}
          {canReprint && seated && lines.some((l) => l.status === "sent") && (
            <Button
              size="touch"
              variant="secondary"
              disabled={reprint.isPending}
              onClick={() => void print("bill")}
            >
              <PrinterIcon />
              {t("history.reprintBill")}
            </Button>
          )}
          {canReprint && order.payments.length > 0 && (
            <Button
              size="touch"
              variant="secondary"
              disabled={reprint.isPending}
              onClick={() => void print("receipt")}
            >
              <PrinterIcon />
              {t("history.reprintReceipt")}
            </Button>
          )}
          {order.status === "paid" && canPay && (
            <Button
              size="touch"
              variant="destructive"
              onClick={() => setRefunding(true)}
            >
              <RotateCcwIcon />
              {t("history.refund")}
            </Button>
          )}
          {seated && nothingSent && (
            <Button
              size="touch"
              variant="destructive"
              onClick={() => setConfirmCancel(true)}
            >
              <XCircleIcon />
              {t("order.cancelOrder")}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("order.cancelConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("order.cancelBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                try {
                  await cancel.mutateAsync(order.id)
                  void refreshList()
                  toast.success(t("order.cancelled"))
                } catch (error) {
                  toast.error(apiErrorMessage(error))
                }
              }}
            >
              {t("order.cancelOrder")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Loaded({
  orderId,
  onClose,
}: {
  orderId: string
  onClose: () => void
}) {
  const order = useOrderQuery(orderId)
  if (order.isPending)
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    )
  if (order.isError)
    return <p className="text-danger-ink">{apiErrorMessage(order.error)}</p>
  return <Body order={order.data} onClose={onClose} />
}

/** One order in full: items (voids struck through), the bill, payments, and what can be done with it. */
export function OrderDetailSheet({
  order,
  onClose,
}: {
  order: {
    id: string
    number: number
    channel: Order["channel"]
    table_label: string
  } | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={order !== null}
      onOpenChange={(open) => !open && onClose()}
      side="center"
      title={order ? `#${order.number} · ${orderLabel(order, t)}` : ""}
      className="w-[min(620px,calc(100vw-2rem))]"
    >
      {order && <Loaded key={order.id} orderId={order.id} onClose={onClose} />}
    </TouchSheet>
  )
}
