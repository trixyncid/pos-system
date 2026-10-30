import { CheckIcon, PercentIcon, PlusIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Pressable } from "@/components/motion/pressable.tsx"
import { CountUp } from "@/components/motion/count-up.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import type { Order, OrderLine } from "@/features/ordering/schemas/order.ts"
import { discountLabel } from "@/features/checkout/lib/discount-label.ts"
import { useBillRules } from "@/features/outlet/hooks/use-bill-rules.ts"
import { formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

export type SplitMode = "full" | "items" | "even"

function Row({
  label,
  children,
  strong,
  tone,
}: {
  label: ReactNode
  children: ReactNode
  strong?: boolean
  tone?: "success" | "muted"
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        strong
          ? "font-heading text-2xl font-semibold"
          : "text-sm text-muted-foreground",
        tone === "success" && "text-success-ink"
      )}
    >
      <span className="min-w-0">{label}</span>
      {children}
    </div>
  )
}

function LineRow({
  line,
  selectable,
  selected,
  onToggle,
}: {
  line: OrderLine
  selectable: boolean
  selected: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const content = (
    <>
      {selectable && (
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border"
          )}
        >
          <AnimatePresence>
            {selected && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={spring.pop}
              >
                <CheckIcon className="size-4" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      )}
      <span className="w-8 shrink-0 font-heading font-semibold tabular-nums">
        {line.quantity}×
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{line.name}</span>
        {line.modifiers.length > 0 && (
          <span className="block truncate text-xs text-muted-foreground">
            {line.modifiers.map((m) => m.name).join(" · ")}
          </span>
        )}
      </span>
      {line.paid ? (
        <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success-ink">
          {t("checkout.paidItem")}
        </span>
      ) : (
        <MoneyText amount={line.total} className="font-medium" />
      )}
    </>
  )
  const classes = cn(
    "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors",
    line.paid && "opacity-55",
    selectable && !line.paid && "border",
    selected && "border-primary bg-primary/5"
  )
  if (!selectable || line.paid) return <li className={classes}>{content}</li>
  return (
    <li>
      <Pressable
        role="checkbox"
        aria-checked={selected}
        onClick={onToggle}
        pressScale={0.98}
        className={classes}
      >
        {content}
      </Pressable>
    </li>
  )
}

/**
 * The left side of checkout: how the table pays (all at once, by item, or
 * split evenly), the lines, and the bill in the order the receipt prints it.
 */
export function BillPanel({
  order,
  mode,
  onMode,
  selected,
  onToggle,
  onSelectAll,
  parts,
  onParts,
  onDiscount,
}: {
  order: Order
  mode: SplitMode
  onMode: (mode: SplitMode) => void
  selected: ReadonlySet<string>
  onToggle: (lineId: string) => void
  onSelectAll: () => void
  parts: number
  onParts: (parts: number) => void
  onDiscount: () => void
}) {
  const { t } = useTranslation()
  const rules = useBillRules()
  const { bill } = order
  const lines = order.lines.filter((line) => line.status !== "void")
  const anyPaid = order.payments.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-5 pt-4 pb-3">
        <Segmented
          label={t("checkout.splitLabel")}
          value={mode}
          onChange={onMode}
          options={[
            { value: "full", label: t("checkout.modeFull") },
            { value: "items", label: t("checkout.modeItems") },
            { value: "even", label: t("checkout.modeEven") },
          ]}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === "items" && (
            <motion.button
              key="all"
              type="button"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              onClick={onSelectAll}
              className="h-11 rounded-xl px-3 text-sm font-medium text-primary"
            >
              {t("checkout.allItems")}
            </motion.button>
          )}
          {mode === "even" && (
            <motion.div
              key="parts"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-3"
            >
              <QtyStepper
                value={parts}
                min={2}
                max={20}
                onChange={onParts}
                labels={{ decrease: "−", increase: "+" }}
              />
              <span className="text-sm text-muted-foreground">
                {t("checkout.partsCount", { count: parts })}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {mode === "items" && (
        <p className="px-5 pb-2 text-sm text-muted-foreground">
          {t("checkout.pickItems")}
        </p>
      )}

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 pb-3">
        {lines.map((line) => (
          <LineRow
            key={line.id}
            line={line}
            selectable={mode === "items"}
            selected={selected.has(line.id)}
            onToggle={() => onToggle(line.id)}
          />
        ))}
      </ul>

      <div className="shrink-0 space-y-1.5 border-t bg-card/80 px-5 py-4">
        <Row label={t("checkout.subtotal")}>
          <MoneyText amount={bill.subtotal} />
        </Row>
        {bill.discount > 0 ? (
          <Row
            label={
              <button
                type="button"
                onClick={onDiscount}
                disabled={anyPaid}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg text-success-ink underline-offset-4 enabled:hover:underline"
              >
                <PercentIcon className="size-3.5" />
                {discountLabel(order, t)}
                {order.discount_reason && (
                  <span className="truncate text-muted-foreground">
                    · {order.discount_reason}
                  </span>
                )}
              </button>
            }
            tone="success"
          >
            <CountUp
              value={-bill.discount}
              format={(n) => `−${formatIDR(Math.abs(Math.round(n)))}`}
              className="tabular-nums"
            />
          </Row>
        ) : (
          !anyPaid && (
            <button
              type="button"
              onClick={onDiscount}
              className="-ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-primary"
            >
              <PlusIcon className="size-4" />
              {t("checkout.addDiscount")}
            </button>
          )
        )}
        {bill.service > 0 && (
          <Row label={t("order.service", { percent: rules.servicePercent })}>
            <MoneyText amount={bill.service} animate />
          </Row>
        )}
        {bill.tax > 0 && (
          <Row label={t("order.tax", { percent: rules.pbjtPercent })}>
            <MoneyText amount={bill.tax} animate />
          </Row>
        )}
        {bill.rounding !== 0 && (
          <Row label={t("order.rounding")}>
            <span className="tabular-nums">
              {bill.rounding > 0 ? "+" : "−"}
              {formatIDR(Math.abs(bill.rounding))}
            </span>
          </Row>
        )}
        <div className="pt-1.5">
          <Row label={t("order.total")} strong>
            <MoneyText amount={bill.total} animate />
          </Row>
        </div>
        {anyPaid && (
          <>
            <Row label={t("checkout.paid")} tone="success">
              <MoneyText amount={-order.paid} animate />
            </Row>
            <Row label={t("checkout.remaining")} strong>
              <MoneyText amount={order.remaining} animate />
            </Row>
          </>
        )}
      </div>
    </div>
  )
}
