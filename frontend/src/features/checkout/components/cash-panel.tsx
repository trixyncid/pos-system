import { Link } from "@tanstack/react-router"
import { BanknoteIcon, LockIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { CountUp } from "@/components/motion/count-up.tsx"
import { Pressable } from "@/components/motion/pressable.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { NumPad } from "@/components/pos/num-pad.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { formatIDR, quickCash } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

/** Eleven digits: ten billion rupiah, more than any drawer holds. */
const MAX_DIGITS = 11

/**
 * The right side of checkout: what is due now, the cash handed over (keypad
 * or one-tap notes), and the change, which turns green once there's enough.
 */
export function CashPanel({
  due,
  tendered,
  onTendered,
  blocked,
  noShift,
  canOpenShift,
  paying,
  onPay,
  wide = false,
}: {
  due: number
  /** Digits only, "" when nothing is typed. */
  tendered: string
  onTendered: (value: string) => void
  /** Why the cashier can't take money yet (held items, nothing picked). */
  blocked: string | null
  noShift: boolean
  canOpenShift: boolean
  paying: boolean
  onPay: () => void
  /**
   * Keypad beside the amounts instead of below them, so the whole panel fits
   * a modal on a landscape tablet without scrolling.
   */
  wide?: boolean
}) {
  const { t } = useTranslation()
  const cash = Number(tendered || 0)
  const enough = due > 0 && cash >= due
  const change = cash - due

  if (noShift)
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-xs space-y-4">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-warning/15 text-warning-ink">
            <LockIcon className="size-7" />
          </div>
          <div className="space-y-1">
            <p className="font-heading text-lg font-semibold">
              {t("checkout.noShift")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("checkout.noShiftBody")}
            </p>
          </div>
          {canOpenShift && (
            <Button asChild size="xl" className="w-full">
              <Link to="/shifts">
                <BanknoteIcon />
                {t("checkout.openShift")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    )

  const keypad = (
    <NumPad
      keyboard
      className={wide ? undefined : "mt-auto"}
      deleteLabel={t("auth.deleteDigit")}
      bottomLeft={{
        label: "000",
        content: "000",
        onPress: () =>
          tendered && onTendered((tendered + "000").slice(0, MAX_DIGITS)),
      }}
      onDigit={(digit) =>
        onTendered((tendered + digit).replace(/^0+/, "").slice(0, MAX_DIGITS))
      }
      onBackspace={() => onTendered(tendered.slice(0, -1))}
    />
  )
  const payButton = (
    <>
      {blocked && (
        <p className="text-center text-sm text-warning-ink">{blocked}</p>
      )}
      <Button
        size="xl"
        className="w-full"
        disabled={!enough || paying || Boolean(blocked)}
        onClick={onPay}
      >
        {paying ? (
          <Spinner />
        ) : (
          <>
            <BanknoteIcon />
            {t("checkout.pay", { amount: formatIDR(due) })}
          </>
        )}
      </Button>
    </>
  )

  const amounts = (
    <>
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("checkout.due")}
        </p>
        <MoneyText
          amount={due}
          animate
          className="block font-heading text-4xl font-semibold"
        />
      </div>

      <div
        className={cn(
          "rounded-2xl border-2 px-4 py-3 transition-colors",
          enough ? "border-success/60 bg-success/5" : "border-border"
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {t("checkout.tendered")}
          </span>
          <span
            data-testid="tendered"
            className={cn(
              "font-heading text-3xl font-semibold tabular-nums",
              !tendered && "text-muted-foreground/50"
            )}
          >
            {formatIDR(cash)}
          </span>
        </div>
        <div className="mt-1 flex h-8 items-baseline justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {enough ? (
              <motion.span
                key="change"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-sm font-medium text-success-ink"
              >
                {t("checkout.change")}
              </motion.span>
            ) : cash > 0 ? (
              <motion.span
                key="short"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-sm font-medium text-danger-ink"
              >
                {t("checkout.short", { amount: formatIDR(due - cash) })}
              </motion.span>
            ) : (
              <span key="none" />
            )}
          </AnimatePresence>
          {enough && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring.pop}
              className="font-heading text-2xl font-semibold text-success-ink"
            >
              <CountUp
                value={change}
                format={formatIDR}
                className="tabular-nums"
              />
            </motion.span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {due > 0 &&
          quickCash(due).map((amount, index) => (
            <Pressable
              key={amount}
              onClick={() => onTendered(String(amount))}
              className={cn(
                "h-12 rounded-xl border font-heading font-semibold tabular-nums transition-colors",
                cash === amount
                  ? "border-primary bg-primary/10"
                  : "bg-background"
              )}
            >
              {index === 0 ? t("checkout.exact") : formatIDR(amount)}
            </Pressable>
          ))}
      </div>
    </>
  )

  if (wide)
    return (
      <div className="grid gap-6 p-5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          {amounts}
          <div className="mt-auto space-y-2">{payButton}</div>
        </div>
        {keypad}
      </div>
    )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-5">
      {amounts}
      {keypad}
      {payButton}
    </div>
  )
}
