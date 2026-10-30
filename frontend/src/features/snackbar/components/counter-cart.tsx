import { ScanBarcodeIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
import { Button } from "@/components/ui/button.tsx"
import type { CounterLine } from "@/features/snackbar/store/cart.ts"
import { formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

function Line({
  line,
  flash,
  onQuantity,
  onRemove,
}: {
  line: CounterLine
  /** Changes on every scan of this line, replaying the highlight. */
  flash: number | null
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }}
      transition={spring.layout}
      className="relative overflow-hidden rounded-2xl bg-card shadow-(--shadow-soft)"
    >
      {flash !== null && (
        <motion.span
          key={flash}
          aria-hidden
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 bg-primary/20"
        />
      )}
      <div className="relative flex items-center gap-2 p-2">
        <ProductImage
          src={line.image}
          alt=""
          className="size-11 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-tight font-medium">
            {line.name}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatIDR(line.unit_price)}
          </p>
        </div>
        <QtyStepper
          size="sm"
          value={line.quantity}
          min={1}
          max={99}
          onChange={onQuantity}
          labels={{ decrease: "−", increase: "+" }}
        />
        <button
          type="button"
          aria-label={t("snackbar.remove", { name: line.name })}
          onClick={onRemove}
          className="grid size-10 place-items-center rounded-xl text-muted-foreground active:bg-muted"
        >
          <Trash2Icon className="size-4" />
        </button>
      </div>
    </motion.li>
  )
}

export function CounterCart({
  lines,
  touched,
  onQuantity,
  onRemove,
  onClear,
}: {
  lines: CounterLine[]
  touched: { id: string; at: number } | null
  onQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <p className="font-heading text-lg font-semibold">
          {t("snackbar.basket")}
          {count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 1.35 }}
              animate={{ scale: 1 }}
              transition={spring.pop}
              className="ml-2 inline-grid h-7 min-w-7 place-items-center rounded-full bg-primary px-2 text-sm text-primary-foreground tabular-nums"
            >
              {count}
            </motion.span>
          )}
        </p>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {t("snackbar.clear")}
          </Button>
        )}
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-3">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <Line
              key={line.id}
              line={line}
              flash={touched?.id === line.id ? touched.at : null}
              onQuantity={(quantity) => onQuantity(line.id, quantity)}
              onRemove={() => onRemove(line.id)}
            />
          ))}
        </AnimatePresence>
        {lines.length === 0 && (
          <li className="grid h-full min-h-60 place-items-center text-center text-muted-foreground">
            <div className="space-y-3">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <ScanBarcodeIcon className="mx-auto size-12 opacity-40" />
              </motion.div>
              <p className="max-w-52 text-sm">{t("snackbar.empty")}</p>
            </div>
          </li>
        )}
      </ul>
    </div>
  )
}

export function CounterTotals({
  bill,
  pbjtPercent,
}: {
  bill: { subtotal: number; tax: number; rounding: number; total: number }
  pbjtPercent: number
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{t("order.subtotal")}</span>
        <MoneyText amount={bill.subtotal} animate />
      </div>
      {bill.tax > 0 && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("order.tax", { percent: pbjtPercent })}</span>
          <MoneyText amount={bill.tax} animate />
        </div>
      )}
      {bill.rounding !== 0 && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("order.rounding")}</span>
          <span className="tabular-nums">
            {bill.rounding > 0 ? "+" : "−"}
            {formatIDR(Math.abs(bill.rounding))}
          </span>
        </div>
      )}
      <div
        className={cn(
          "flex justify-between font-heading text-2xl font-semibold"
        )}
      >
        <span>{t("order.total")}</span>
        <MoneyText amount={bill.total} animate />
      </div>
    </div>
  )
}
