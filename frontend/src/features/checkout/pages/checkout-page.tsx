import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { ArrowLeftIcon, PrinterIcon, ReceiptTextIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import {
  usePay,
  usePrintBill,
  type PayMethod,
} from "@/features/checkout/api/checkout.ts"
import {
  BillPanel,
  type SplitMode,
} from "@/features/checkout/components/bill-panel.tsx"
import { CashPanel } from "@/features/checkout/components/cash-panel.tsx"
import { DiscountSheet } from "@/features/checkout/components/discount-sheet.tsx"
import { PaidOverlay } from "@/features/checkout/components/paid-overlay.tsx"
import { discountLabel } from "@/features/checkout/lib/discount-label.ts"
import { useCustomerDisplay } from "@/features/display/hooks/use-customer-display.ts"
import { useOrderQuery } from "@/features/ordering/api/orders.ts"
import type { Order } from "@/features/ordering/schemas/order.ts"
import { useBillRules } from "@/features/outlet/hooks/use-bill-rules.ts"
import { useCurrentShiftQuery } from "@/features/shifts/api/shifts.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { newId } from "@/lib/idempotency.ts"
import { discountAmount, evenPart, shareTotals } from "@/lib/money.ts"

/** What this payment covers, as the API will charge it (backend payments/services.pay). */
function amountDue(
  order: Order,
  mode: SplitMode,
  selected: ReadonlySet<string>,
  parts: number,
  rules: ReturnType<typeof useBillRules>
) {
  if (mode === "even") return evenPart(order.remaining, parts, rules.rounding)
  if (mode === "full") return order.remaining
  const unpaid = order.lines.filter((l) => l.status !== "void" && !l.paid)
  const picked = unpaid.filter((l) => selected.has(l.id))
  if (!picked.length) return 0
  if (picked.length === unpaid.length) return order.remaining
  const part = picked.reduce((sum, line) => sum + line.total, 0)
  const discount = discountAmount(
    order.discount_kind,
    order.discount_value,
    order.subtotal
  )
  const taxable = picked
    .filter((line) => line.tax_category === "pbjt")
    .reduce((sum, line) => sum + line.total, 0)
  return Math.min(
    shareTotals(part, order.subtotal, discount, rules, {
      service: order.channel !== "snackbar",
      taxable,
    }).total,
    order.remaining
  )
}

export function CheckoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { orderId } = useParams({ from: "/app/pos/checkout/$orderId" })
  const order = useOrderQuery(orderId)
  const shift = useCurrentShiftQuery()
  const rules = useBillRules()
  const pay = usePay()
  const printBill = usePrintBill()
  const canOpenShift = useCan(perm.openShift)

  const [mode, setMode] = useState<SplitMode>("full")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [parts, setParts] = useState(2)
  const [tendered, setTendered] = useState("")
  const [method, setMethod] = useState<PayMethod>("cash")
  const [discountOpen, setDiscountOpen] = useState(false)
  const [result, setResult] = useState<{
    change: number
    remaining: number
    total: number
  } | null>(null)
  // One id per payment attempt: a retry after a dropped connection is not charged twice.
  const paymentId = useRef(newId())

  // The guest sees their bill on the second screen while paying, then the change.
  const shown = order.data
  useCustomerDisplay(
    result
      ? { view: "paid", total: result.total, change: result.change }
      : shown && (shown.status === "open" || shown.status === "billed")
        ? {
            view: "cart",
            channel: "restaurant",
            label: shown.table_label
              ? t("order.table", { label: shown.table_label })
              : t("order.takeaway", { number: shown.number }),
            lines: shown.lines
              .filter((line) => line.status !== "void")
              .map((line) => ({
                id: line.id,
                name: line.name,
                quantity: line.quantity,
                total: line.total,
                detail:
                  line.modifiers.map((m) => m.name).join(", ") || undefined,
              })),
            bill: shown.bill,
            discountLabel:
              shown.bill.discount > 0 ? discountLabel(shown, t) : undefined,
            due: amountDue(shown, mode, selected, parts, rules),
          }
        : null
  )

  const finish = useCallback(() => {
    const settled = (result?.remaining ?? 1) <= 0
    setResult(null)
    if (settled) void navigate({ to: "/floor" })
  }, [result, navigate])

  if (order.isPending)
    return (
      <div className="grid h-full grid-cols-[minmax(0,1fr)_26rem] gap-4 p-4">
        <Skeleton className="rounded-3xl" />
        <Skeleton className="rounded-3xl" />
      </div>
    )

  const back = (
    <Button asChild size="touch">
      <Link to="/floor">
        <ArrowLeftIcon />
        {t("checkout.backToFloor")}
      </Link>
    </Button>
  )
  if (order.isError)
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="space-y-4">
          <p className="text-muted-foreground">{t("order.notFound")}</p>
          {back}
        </div>
      </div>
    )

  const current = order.data
  const settledView = current.status !== "open" && current.status !== "billed"
  const title = current.table_label
    ? t("order.table", { label: current.table_label })
    : t("order.takeaway", { number: current.number })
  const due = settledView ? 0 : amountDue(current, mode, selected, parts, rules)
  const live = current.lines.filter((l) => l.status !== "void")
  const blocked = current.lines.some((l) => l.status === "held")
    ? t("checkout.heldWaiting")
    : !live.length
      ? t("checkout.nothingToPay")
      : null

  const submit = async () => {
    try {
      const updated = await pay.mutateAsync({
        orderId,
        id: paymentId.current,
        method,
        tendered: Number(tendered),
        ...(mode === "items" ? { line_ids: [...selected] } : {}),
        ...(mode === "even" && due < current.remaining ? { amount: due } : {}),
      })
      const payment = updated.payments.find((p) => p.id === paymentId.current)
      paymentId.current = newId()
      setResult({
        change: payment?.change ?? 0,
        remaining: updated.remaining,
        total: payment?.amount ?? 0,
      })
      setTendered("")
      setSelected(new Set())
      // One guest of an even split has paid; the last one pays whatever is left.
      if (mode === "even") {
        if (parts <= 2) setMode("full")
        else setParts(parts - 1)
      }
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex min-h-0 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <Button asChild variant="ghost" size="touch" className="px-3">
            <Link to="/order/$orderId" params={{ orderId }}>
              <ArrowLeftIcon />
              {t("checkout.back")}
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-xl font-semibold">
              {t("checkout.title", { label: title })}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              #{current.number} · {current.waiter}
              {current.status === "billed" && ` · ${t("checkout.billed")}`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="touch"
            disabled={settledView || Boolean(blocked) || printBill.isPending}
            onClick={async () => {
              try {
                await printBill.mutateAsync(orderId)
                toast.success(t("checkout.billPrinted"))
              } catch (error) {
                toast.error(apiErrorMessage(error))
              }
            }}
          >
            {current.status === "billed" ? (
              <ReceiptTextIcon />
            ) : (
              <PrinterIcon />
            )}
            {t("checkout.printBill")}
          </Button>
        </header>
        {settledView && !result ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div className="space-y-4">
              <p className="text-muted-foreground">{t("order.closed")}</p>
              {back}
            </div>
          </div>
        ) : (
          <BillPanel
            order={current}
            mode={mode}
            onMode={(next) => {
              setMode(next)
              setTendered("")
            }}
            selected={selected}
            onToggle={(lineId) =>
              setSelected((previous) => {
                const next = new Set(previous)
                if (next.has(lineId)) next.delete(lineId)
                else next.add(lineId)
                return next
              })
            }
            onSelectAll={() =>
              setSelected(
                new Set(
                  current.lines
                    .filter((l) => l.status !== "void" && !l.paid)
                    .map((l) => l.id)
                )
              )
            }
            parts={parts}
            onParts={setParts}
            onDiscount={() => setDiscountOpen(true)}
          />
        )}
      </div>

      <aside className="min-h-0 border-l bg-background/60">
        <CashPanel
          due={due}
          tendered={tendered}
          onTendered={setTendered}
          method={method}
          onMethod={setMethod}
          blocked={settledView ? null : blocked}
          noShift={shift.isSuccess && shift.data === null}
          canOpenShift={canOpenShift}
          paying={pay.isPending}
          onPay={() => void submit()}
        />
      </aside>

      <DiscountSheet
        order={current}
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
      />
      <AnimatePresence>
        {result && (
          <PaidOverlay
            change={result.change}
            remaining={result.remaining}
            onDone={finish}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
