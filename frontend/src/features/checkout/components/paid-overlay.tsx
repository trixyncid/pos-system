import { PrinterIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"
import { formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"

const AUTO_CLOSE_MS = 4_000

/**
 * After a payment: a check that draws itself, the change to hand back, and
 * either a countdown to the floor (bill settled) or what is still due.
 */
export function PaidOverlay({
  change,
  remaining,
  onDone,
  doneLabel,
}: {
  change: number
  remaining: number
  onDone: () => void
  /** The settled button; "Back to the floor" by default. */
  doneLabel?: string
}) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const settled = remaining <= 0

  useEffect(() => {
    if (!settled) return
    const timer = window.setTimeout(onDone, AUTO_CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [settled, onDone])

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-6 backdrop-blur-md"
      onClick={settled ? onDone : undefined}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.sheet}
        className="w-full max-w-md space-y-6 text-center"
      >
        <svg viewBox="0 0 96 96" className="mx-auto size-28" aria-hidden>
          <motion.circle
            cx="48"
            cy="48"
            r="44"
            className="fill-success/15 stroke-success"
            strokeWidth="4"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path
            d="M29 49 L42 62 L67 35"
            fill="none"
            className="stroke-success"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.35, duration: 0.35, ease: "easeOut" }}
          />
        </svg>

        <div className="space-y-1">
          <h2 className="font-heading text-2xl font-semibold">
            {settled ? t("checkout.successTitle") : t("checkout.partTitle")}
          </h2>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <PrinterIcon className="size-4" />
            {t("checkout.receiptPrinted")}
          </p>
        </div>

        {change > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="rounded-3xl bg-success/10 px-6 py-5"
          >
            <p className="text-sm font-medium text-success-ink">
              {t("checkout.giveChange")}
            </p>
            <p className="font-heading text-5xl font-semibold text-success-ink tabular-nums">
              {formatIDR(change)}
            </p>
          </motion.div>
        )}

        {settled ? (
          <div className="space-y-3">
            <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full origin-left rounded-full bg-success"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: AUTO_CLOSE_MS / 1000, ease: "linear" }}
              />
            </div>
            <Button size="xl" variant="secondary" onClick={onDone}>
              {doneLabel ?? t("checkout.backToFloor")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-heading text-xl font-semibold">
              {t("checkout.stillDue", { amount: formatIDR(remaining) })}
            </p>
            <Button size="xl" onClick={onDone}>
              {t("checkout.nextGuest")}
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
