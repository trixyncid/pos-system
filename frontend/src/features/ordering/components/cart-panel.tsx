import {
  BanknoteIcon,
  CheckIcon,
  PauseIcon,
  PercentIcon,
  PrinterIcon,
  SendIcon,
  ShoppingBagIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { useCan, useCanAny } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { CartLine } from "@/features/ordering/components/cart-line.tsx"
import { discountLabel } from "@/features/checkout/lib/discount-label.ts"
import { useLanded } from "@/features/ordering/components/fly-to-cart.tsx"
import type {
  DraftLine,
  Order,
  OrderLine,
} from "@/features/ordering/schemas/order.ts"
import { useBillRules } from "@/features/outlet/hooks/use-bill-rules.ts"
import { CountUp } from "@/components/motion/count-up.tsx"
import { billTotals, discountAmount, formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-8 items-center justify-between px-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
        {action}
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </ul>
    </div>
  )
}

function TotalRow({
  label,
  amount,
  strong = false,
  signed = false,
}: {
  label: string
  amount: number
  strong?: boolean
  /** Rounding can go either way, so it always shows its sign. */
  signed?: boolean
}) {
  return (
    <div
      className={cn(
        "flex justify-between",
        strong
          ? "font-heading text-xl font-semibold"
          : "text-sm text-muted-foreground"
      )}
    >
      <span>{label}</span>
      {signed ? (
        <CountUp
          value={amount}
          format={(n) =>
            `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatIDR(Math.abs(Math.round(n)))}`
          }
          className="tabular-nums"
        />
      ) : (
        <MoneyText amount={amount} animate />
      )}
    </div>
  )
}

/**
 * The right-hand cart: new lines (only on this tablet), held lines, and what
 * the kitchen already has. Totals follow the outlet's service, PBJT and
 * rounding rules as lines change.
 */
export function CartPanel({
  order,
  drafts,
  sending,
  onEditDraft,
  onRemoveDraft,
  onToggleHold,
  onVoid,
  onSend,
  onSendHeld,
  onPay,
  onPrintBill,
  onDiscount,
  printingBill,
}: {
  order: Order
  drafts: DraftLine[]
  sending: boolean
  onEditDraft: (line: DraftLine) => void
  onRemoveDraft: (line: DraftLine) => void
  onToggleHold: (line: DraftLine) => void
  onVoid: (line: OrderLine) => void
  onSend: () => Promise<boolean>
  onSendHeld: () => void
  /** Present when the user takes payments. */
  onPay?: () => void
  onPrintBill?: () => void
  onDiscount: () => void
  printingBill: boolean
}) {
  const { t } = useTranslation()
  // A waiter can't void what the kitchen has, or discount a bill.
  const canVoidSent = useCan(perm.voidSentItem)
  const canDiscount = useCanAny([perm.applyDiscount, perm.takePayment])
  const rules = useBillRules()
  const landed = useLanded()
  const [justSent, setJustSent] = useState(false)

  useEffect(() => {
    if (!justSent) return
    const timer = window.setTimeout(() => setJustSent(false), 1600)
    return () => window.clearTimeout(timer)
  }, [justSent])

  const held = order.lines.filter((line) => line.status === "held")
  const sent = order.lines.filter((line) => line.status === "sent")
  const voided = order.lines.filter((line) => line.status === "void")
  const draftCount = drafts.reduce((sum, line) => sum + line.quantity, 0)
  const toSend = drafts
    .filter((line) => !line.hold)
    .reduce((sum, line) => sum + line.quantity, 0)

  const subtotal =
    order.subtotal +
    drafts.reduce((sum, line) => sum + line.unit_price * line.quantity, 0)
  // The API's bill, or a preview of it while new lines are still on this tablet.
  const bill = drafts.length
    ? billTotals(
        subtotal,
        // A promo's discount comes from the API; new lines may change it once sent.
        order.promo
          ? order.bill.discount
          : discountAmount(order.discount_kind, order.discount_value, subtotal),
        rules,
        {
          // New lines are counted as PBJT until the API says otherwise.
          taxable:
            subtotal -
            order.lines
              .filter((l) => l.status !== "void" && l.tax_category !== "pbjt")
              .reduce((sum, l) => sum + l.total, 0),
        }
      )
    : order.bill
  const empty = drafts.length + order.lines.length === 0
  // Ready to settle: everything is at the kitchen and nothing waits on this tablet.
  const settle =
    drafts.length === 0 &&
    held.length === 0 &&
    sent.length > 0 &&
    !justSent &&
    onPay !== undefined

  return (
    <aside className="flex min-h-0 flex-col border-l bg-background/60">
      <div
        className="flex h-14 shrink-0 items-center justify-between px-4"
        data-cart-target
      >
        <p className="font-heading text-lg font-semibold">{t("order.cart")}</p>
        <motion.span
          key={landed}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={spring.pop}
          className="grid h-8 min-w-8 place-items-center rounded-full bg-primary px-2 text-sm font-semibold text-primary-foreground tabular-nums"
        >
          {draftCount +
            order.lines
              .filter((l) => l.status !== "void")
              .reduce((s, l) => s + l.quantity, 0)}
        </motion.span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-4">
        {empty && (
          <div className="grid h-full place-items-center text-center text-muted-foreground">
            <div className="space-y-3">
              <ShoppingBagIcon className="mx-auto size-10 opacity-40" />
              <p className="max-w-48 text-sm">{t("order.cartEmpty")}</p>
            </div>
          </div>
        )}
        {drafts.length > 0 && (
          <Section title={t("order.newLines")}>
            {drafts.map((line) => (
              <CartLine
                key={line.id}
                quantity={line.quantity}
                name={line.name}
                modifiers={line.modifiers.map((m) => m.name)}
                note={line.note}
                seat={line.seat}
                total={line.unit_price * line.quantity}
                held={line.hold}
                onTap={() => onEditDraft(line)}
                onSwipe={() => onRemoveDraft(line)}
                swipeLabel={t("order.swipeRemove")}
                trailing={
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleHold(line)
                    }}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
                      line.hold
                        ? "bg-warning/15 text-warning-ink"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <PauseIcon className="size-3" />
                    {line.hold ? t("order.held") : t("order.hold")}
                  </button>
                }
              />
            ))}
          </Section>
        )}
        {held.length > 0 && (
          <Section
            title={t("order.heldLines")}
            action={
              <Button size="sm" variant="secondary" onClick={onSendHeld}>
                <SendIcon />
                {t("order.sendHeldShort")}
              </Button>
            }
          >
            {held.map((line) => (
              <CartLine
                key={line.id}
                quantity={line.quantity}
                name={line.name}
                modifiers={line.modifiers.map((m) => m.name)}
                note={line.note}
                seat={line.seat}
                total={line.total}
                tone="sent"
                held
                onSwipe={() => onVoid(line)}
                swipeLabel={t("order.swipeRemove")}
              />
            ))}
          </Section>
        )}
        {sent.length > 0 && (
          <Section title={t("order.sentLines")}>
            {sent.map((line) => (
              <CartLine
                key={line.id}
                quantity={line.quantity}
                name={line.name}
                modifiers={line.modifiers.map((m) => m.name)}
                note={line.note}
                seat={line.seat}
                total={line.total}
                tone="sent"
                onSwipe={canVoidSent ? () => onVoid(line) : undefined}
                swipeLabel={t("order.swipeVoid")}
              />
            ))}
          </Section>
        )}
        {voided.length > 0 && (
          <Section title={t("order.voidLines")}>
            {voided.map((line) => (
              <CartLine
                key={line.id}
                quantity={line.quantity}
                name={line.name}
                modifiers={line.modifiers.map((m) => m.name)}
                note={line.void_reason}
                seat={line.seat}
                total={line.total}
                tone="void"
              />
            ))}
          </Section>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t bg-card/90 p-4 backdrop-blur">
        <div className="space-y-1">
          <TotalRow label={t("order.subtotal")} amount={bill.subtotal} />
          {bill.discount > 0 && (
            <TotalRow label={discountLabel(order, t)} amount={-bill.discount} />
          )}
          {bill.service > 0 && (
            <TotalRow
              label={t("order.service", { percent: rules.servicePercent })}
              amount={bill.service}
            />
          )}
          {bill.tax > 0 && (
            <TotalRow
              label={t("order.tax", { percent: rules.pbjtPercent })}
              amount={bill.tax}
            />
          )}
          {bill.rounding !== 0 && (
            <TotalRow
              label={t("order.rounding")}
              amount={bill.rounding}
              signed
            />
          )}
          <TotalRow label={t("order.total")} amount={bill.total} strong />
        </div>
        {sent.length > 0 && drafts.length === 0 && (
          <div className="flex gap-2">
            {canDiscount && (
              <Button
                variant="secondary"
                size="touch"
                className="flex-1"
                disabled={order.payments.length > 0}
                onClick={onDiscount}
              >
                <PercentIcon />
                {t("order.discount")}
              </Button>
            )}
            {onPrintBill && (
              <Button
                variant="secondary"
                size="touch"
                className="flex-1"
                disabled={held.length > 0 || printingBill}
                onClick={onPrintBill}
              >
                {printingBill ? <Spinner /> : <PrinterIcon />}
                {order.status === "billed"
                  ? t("order.billedBadge")
                  : t("order.printBill")}
              </Button>
            )}
          </div>
        )}
        {settle ? (
          <Button size="xl" className="w-full" onClick={onPay}>
            <BanknoteIcon />
            {t("checkout.payFrom", { amount: formatIDR(order.remaining) })}
          </Button>
        ) : (
          <Button
            size="xl"
            className={cn(
              "w-full transition-colors",
              justSent && "bg-success hover:bg-success"
            )}
            disabled={sending || (drafts.length === 0 && !justSent)}
            onClick={async () => {
              if (await onSend()) setJustSent(true)
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={justSent ? "sent" : sending ? "sending" : "send"}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="flex items-center gap-2"
              >
                {justSent ? (
                  <>
                    <CheckIcon />
                    {t("order.sent")}
                  </>
                ) : sending ? (
                  <Spinner />
                ) : toSend > 0 ? (
                  <>
                    <SendIcon />
                    {t("order.sendCount", { count: toSend })}
                  </>
                ) : drafts.length > 0 ? (
                  <>
                    <PauseIcon />
                    {t("order.saveHeld", { count: draftCount })}
                  </>
                ) : (
                  <>
                    <SendIcon />
                    {t("order.send")}
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </Button>
        )}
      </div>
    </aside>
  )
}
