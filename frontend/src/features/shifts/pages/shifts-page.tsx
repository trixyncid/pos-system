import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  LockIcon,
  WalletIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { CountUp } from "@/components/motion/count-up.tsx"
import { Pressable } from "@/components/motion/pressable.tsx"
import { RiseIn } from "@/components/motion/rise-in.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Button } from "@/components/ui/button.tsx"
import { MoneyInput } from "@/components/ui/money-input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import {
  useCurrentShiftQuery,
  useOpenShift,
  useShiftHistoryQuery,
} from "@/features/shifts/api/shifts.ts"
import { CloseShiftSheet } from "@/features/shifts/components/close-shift-sheet.tsx"
import { MoveCashSheet } from "@/features/shifts/components/move-cash-sheet.tsx"
import { signedIDR, varianceTone } from "@/features/shifts/lib/variance.ts"
import type { Shift } from "@/features/shifts/schemas/shift.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

const time = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})
const day = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
})

const FLOATS = [300_000, 500_000, 1_000_000] as const

function OpenShiftCard() {
  const { t } = useTranslation()
  const canOpen = useCan(perm.openShift)
  const openShift = useOpenShift()
  const [cash, setCash] = useState("")

  return (
    <RiseIn className="mx-auto max-w-md space-y-6 py-10 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent text-accent-foreground">
        <LockIcon className="size-7" />
      </span>
      <div className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold">
          {t("shifts.closedTitle")}
        </h2>
        <p className="text-muted-foreground">{t("shifts.closedBody")}</p>
      </div>
      {canOpen && (
        <div className="space-y-3 text-left">
          <p className="text-sm font-medium">{t("shifts.openingCash")}</p>
          <MoneyInput
            value={cash}
            onChange={setCash}
            className="h-14 rounded-2xl pl-11 font-heading text-2xl"
            prefixClassName="left-4 text-base"
          />
          <div className="grid grid-cols-3 gap-2">
            {FLOATS.map((amount) => (
              <Pressable
                key={amount}
                onClick={() => setCash(String(amount))}
                className={cn(
                  "h-12 rounded-xl border font-medium tabular-nums transition-colors",
                  Number(cash) === amount
                    ? "border-primary bg-primary/10"
                    : "bg-background"
                )}
              >
                {formatIDR(amount)}
              </Pressable>
            ))}
          </div>
          <Button
            size="xl"
            className="w-full"
            disabled={cash === "" || openShift.isPending}
            onClick={async () => {
              try {
                await openShift.mutateAsync(Number(cash))
                toast.success(t("shifts.opened"))
              } catch (error) {
                toast.error(apiErrorMessage(error))
              }
            }}
          >
            {openShift.isPending ? <Spinner /> : <WalletIcon />}
            {t("shifts.open")}
          </Button>
        </div>
      )}
    </RiseIn>
  )
}

function Stat({
  label,
  amount,
  sign,
}: {
  label: string
  amount: number
  sign?: "+" | "−"
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-(--shadow-soft)">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-heading text-xl font-semibold tabular-nums",
          sign === "−" && amount > 0 && "text-danger-ink"
        )}
      >
        {sign && amount > 0 ? sign : ""}
        <CountUp value={amount} format={formatIDR} />
      </p>
    </div>
  )
}

function CurrentShift({ shift }: { shift: Shift }) {
  const { t } = useTranslation()
  const canMove = useCan(perm.openDrawer)
  const canClose = useCan(perm.closeShift)
  const [moving, setMoving] = useState<"in" | "out" | null>(null)
  const [closing, setClosing] = useState(false)
  const { totals } = shift

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <StatusPill tone="success" pulse>
            {t("shifts.openSince", {
              time: time.format(new Date(shift.created_at)),
              name: shift.opened_by_name,
            })}
          </StatusPill>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("shifts.expected")}
          </p>
          <p
            data-testid="expected-cash"
            className="font-heading text-5xl font-semibold tabular-nums"
          >
            <CountUp value={totals.expected_cash} format={formatIDR} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMove && (
            <>
              <Button
                variant="secondary"
                size="touch"
                onClick={() => setMoving("in")}
              >
                <ArrowDownLeftIcon />
                {t("shifts.addIn")}
              </Button>
              <Button
                variant="secondary"
                size="touch"
                onClick={() => setMoving("out")}
              >
                <ArrowUpRightIcon />
                {t("shifts.addOut")}
              </Button>
            </>
          )}
          {canClose && (
            <Button size="touch" onClick={() => setClosing(true)}>
              <LockIcon />
              {t("shifts.close")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("shifts.openingCash")} amount={shift.opening_cash} />
        <Stat label={t("shifts.cashSales")} amount={totals.cash_sales} />
        {totals.other_sales > 0 && (
          <Stat label={t("shifts.qrisSales")} amount={totals.other_sales} />
        )}
        <Stat label={t("shifts.cashIn")} amount={totals.cash_in} sign="+" />
        <Stat label={t("shifts.cashOut")} amount={totals.cash_out} sign="−" />
        {totals.refunds > 0 && (
          <Stat label={t("shifts.refunds")} amount={totals.refunds} sign="−" />
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-heading font-semibold">
            {t("shifts.movements")}
          </h3>
          <span className="text-sm text-muted-foreground">
            {t("shifts.transactions")}: {totals.payments}
          </span>
        </div>
        {shift.movements.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {canMove ? t("shifts.noMovements") : t("shifts.noDrawer")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {[...shift.movements].reverse().map((movement) => (
                <motion.li
                  key={movement.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring.layout}
                  className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-(--shadow-soft)"
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-xl",
                      movement.kind === "in"
                        ? "bg-success/12 text-success-ink"
                        : "bg-danger/12 text-danger-ink"
                    )}
                  >
                    {movement.kind === "in" ? (
                      <ArrowDownLeftIcon className="size-4" />
                    ) : (
                      <ArrowUpRightIcon className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {movement.reason}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {time.format(new Date(movement.created_at))} ·{" "}
                      {movement.by_name}
                    </span>
                  </span>
                  <span className="font-heading font-semibold tabular-nums">
                    {movement.kind === "in" ? "+" : "−"}
                    {formatIDR(movement.amount)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <MoveCashSheet
        shiftId={shift.id}
        kind={moving}
        onClose={() => setMoving(null)}
      />
      <CloseShiftSheet
        shift={shift}
        open={closing}
        onClose={() => setClosing(false)}
      />
    </div>
  )
}

function History() {
  const { t } = useTranslation()
  const history = useShiftHistoryQuery()
  const closed = history.data?.filter((shift) => shift.closed_at) ?? []

  return (
    <aside className="min-h-0 space-y-3 overflow-y-auto border-l p-5">
      <h2 className="font-heading font-semibold">{t("shifts.history")}</h2>
      {history.isPending ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : closed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("shifts.noHistory")}</p>
      ) : (
        <ul className="space-y-2">
          {closed.map((shift) => {
            const variance = shift.variance ?? 0
            return (
              <li
                key={shift.id}
                className="space-y-1 rounded-2xl bg-card p-4 shadow-(--shadow-soft)"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {day.format(new Date(shift.created_at))}
                  </span>
                  <StatusPill tone={varianceTone(variance)}>
                    {signedIDR(variance)}
                  </StatusPill>
                </div>
                <p className="text-xs text-muted-foreground">
                  {time.format(new Date(shift.created_at))}–
                  {shift.closed_at && time.format(new Date(shift.closed_at))} ·{" "}
                  {shift.closed_by_name}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("shifts.counted")}
                  </span>
                  <MoneyText amount={shift.counted_cash ?? 0} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

export function ShiftsPage() {
  const { t } = useTranslation()
  const current = useCurrentShiftQuery()

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-h-0 space-y-6 overflow-y-auto p-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {t("shifts.title")}
          </h1>
          <p className="text-muted-foreground">{t("shifts.subtitle")}</p>
        </div>
        {current.isPending ? (
          <Skeleton className="h-64 rounded-3xl" />
        ) : current.data ? (
          <CurrentShift shift={current.data} />
        ) : (
          <OpenShiftCard />
        )}
      </div>
      <History />
    </div>
  )
}
