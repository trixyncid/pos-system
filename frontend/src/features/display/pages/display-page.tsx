import { CheckIcon, WifiOffIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { BRAND, BrandMark, MeanderBand } from "@/components/pos/brand.tsx"
import {
  connectDisplay,
  type LinkStatus,
  type Outlet,
} from "@/features/display/lib/link.ts"
import {
  IDLE,
  type DisplayLine,
  type DisplayState,
} from "@/features/display/lib/state.ts"
import { formatIDR } from "@/lib/money.ts"
import { pointToDisplayManifest } from "@/lib/pwa.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

/** After "thank you", the screen goes back to the welcome on its own. */
const PAID_HOLD_MS = 12_000

function Pairing({ code }: { code: string }) {
  const { t } = useTranslation()
  return (
    <main className="grid h-dvh place-items-center bg-canvas p-10 text-center">
      <div className="max-w-xl space-y-8">
        <BrandMark size="lg" className="mx-auto" />
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold">
            {t("display.pairTitle")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("display.pairHow")}
          </p>
        </div>
        <p
          aria-label={code.split("").join(" ")}
          className="font-heading text-8xl font-semibold tracking-[0.25em] text-primary tabular-nums"
        >
          {code}
        </p>
      </div>
    </main>
  )
}

function Welcome({ outlet }: { outlet: Outlet | null }) {
  const { t } = useTranslation()
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-brand text-white">
      <MeanderBand className="text-white/25" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 size-[60%] -translate-x-1/2 rounded-full bg-brand-gold/20 blur-3xl"
      />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <BrandMark size="xl" />
        <div className="space-y-2">
          <p className="font-heading text-6xl font-semibold tracking-wide">
            {BRAND.hanzi}
          </p>
          <p className="font-heading text-2xl font-medium text-white/85">
            {outlet?.name ?? BRAND.name}
          </p>
        </div>
        <p className="font-heading text-3xl font-semibold">
          {t("display.welcome")}
        </p>
      </div>
      {outlet?.address && (
        <p className="relative bg-brand-deep/60 py-4 text-center text-base text-white/80">
          {outlet.address}
        </p>
      )}
      <MeanderBand className="text-white/25" />
    </main>
  )
}

function Line({ line, touched }: { line: DisplayLine; touched: boolean }) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (touched)
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [touched])
  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={spring.layout}
      className={cn(
        "grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-baseline gap-3 rounded-2xl px-4 py-3 transition-colors md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:gap-4 md:px-5 md:py-4",
        touched && "animate-flash bg-accent"
      )}
    >
      <span className="font-heading text-xl font-semibold text-primary tabular-nums md:text-2xl">
        {line.quantity}×
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xl font-medium md:text-2xl">
          {line.name}
        </span>
        {line.detail && (
          <span className="block truncate text-base text-muted-foreground">
            {line.detail}
          </span>
        )}
      </span>
      <span className="font-heading text-xl font-semibold tabular-nums md:text-2xl">
        {formatIDR(line.total)}
      </span>
    </motion.li>
  )
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-lg text-white/85">
      <span>{label}</span>
      <span className="tabular-nums">
        {amount < 0 ? `−${formatIDR(-amount)}` : formatIDR(amount)}
      </span>
    </div>
  )
}

function Bill({ state }: { state: Extract<DisplayState, { view: "cart" }> }) {
  const { t } = useTranslation()
  const { bill } = state
  const count = state.lines.reduce((sum, line) => sum + line.quantity, 0)
  return (
    // Side by side on the 11.6" monitor; stacked (items above the total) on a narrow or portrait screen.
    <main className="grid h-dvh grid-rows-[minmax(0,1fr)_auto] bg-canvas md:grid-cols-[minmax(0,1fr)_minmax(20rem,32%)] md:grid-rows-none">
      <section className="flex min-h-0 flex-col">
        <header className="flex items-center gap-4 border-b bg-background px-8 py-5">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-2xl font-semibold">
              {state.label}
            </p>
            <p className="text-base text-muted-foreground">
              {t("display.items", { count })}
            </p>
          </div>
        </header>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
          <AnimatePresence initial={false}>
            {state.lines.map((line) => (
              <Line
                key={line.id}
                line={line}
                touched={line.id === state.touched}
              />
            ))}
          </AnimatePresence>
          {state.lines.length === 0 && (
            <li className="grid h-full place-items-center text-xl text-muted-foreground">
              {t("display.empty")}
            </li>
          )}
        </ul>
      </section>
      <aside className="flex flex-col bg-brand text-white">
        <MeanderBand className="hidden text-white/25 md:block" />
        <div className="flex flex-1 flex-col justify-end gap-2 p-5 md:gap-3 md:p-8">
          <Row label={t("display.subtotal")} amount={bill.subtotal} />
          {bill.discount > 0 && (
            <Row
              label={state.discountLabel ?? t("display.discount")}
              amount={-bill.discount}
            />
          )}
          {bill.service > 0 && (
            <Row label={t("display.service")} amount={bill.service} />
          )}
          {bill.tax > 0 && <Row label={t("display.tax")} amount={bill.tax} />}
          {bill.rounding !== 0 && (
            <Row label={t("display.rounding")} amount={bill.rounding} />
          )}
          <div className="mt-2 border-t border-white/25 pt-4 md:mt-4 md:pt-6">
            <p className="text-lg font-medium text-white/80">
              {t("display.total")}
            </p>
            <motion.p
              key={bill.total}
              initial={{ scale: 0.96, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring.pop}
              className="origin-left font-heading text-5xl font-semibold tabular-nums md:text-6xl"
            >
              {formatIDR(bill.total)}
            </motion.p>
            {state.due !== undefined && state.due !== bill.total && (
              <p className="mt-3 rounded-2xl bg-brand-deep/60 px-4 py-3 text-xl">
                {t("display.dueNow")}{" "}
                <span className="font-heading font-semibold tabular-nums">
                  {formatIDR(state.due)}
                </span>
              </p>
            )}
          </div>
        </div>
        <MeanderBand className="hidden text-white/25 md:block" />
      </aside>
    </main>
  )
}

function Paid({ state }: { state: Extract<DisplayState, { view: "paid" }> }) {
  const { t } = useTranslation()
  return (
    <main className="relative flex h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-brand text-center text-white">
      <MeanderBand className="absolute top-0 text-white/25" />
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.pop}
        className="grid size-32 place-items-center rounded-full bg-white text-brand"
      >
        <CheckIcon className="size-16" strokeWidth={3} />
      </motion.span>
      <div className="space-y-3">
        <p className="font-heading text-6xl font-semibold">
          {t("display.thanks")}
        </p>
        <p className="text-2xl text-white/85">
          {t("display.paid")}{" "}
          <span className="font-heading font-semibold tabular-nums">
            {formatIDR(state.total)}
          </span>
        </p>
      </div>
      {state.change > 0 && (
        <div className="rounded-3xl bg-white px-10 py-6 text-brand-deep">
          <p className="text-xl font-medium">{t("display.change")}</p>
          <p className="font-heading text-6xl font-semibold tabular-nums">
            {formatIDR(state.change)}
          </p>
        </div>
      )}
      <MeanderBand className="absolute bottom-0 text-white/25" />
    </main>
  )
}

/**
 * The customer-facing screen: the cashier PC's second monitor (opened in its
 * own kiosk window) or a tablet facing the counter. No staff login; it pairs
 * once with a code and then mirrors the paired cashier.
 */
export function DisplayPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<LinkStatus>({ kind: "starting" })
  const [outlet, setOutlet] = useState<Outlet | null>(null)

  useEffect(pointToDisplayManifest, [])
  useEffect(() => connectDisplay(setStatus, setOutlet), [])

  const state: DisplayState =
    status.kind === "live" || status.kind === "offline" ? status.state : IDLE
  const paidKey = state.view === "paid" ? JSON.stringify(state) : null

  // A "thank you" left up by a cashier who walked away still clears itself.
  const [expired, setExpired] = useState<string | null>(null)
  useEffect(() => {
    if (!paidKey) return
    const timer = window.setTimeout(() => setExpired(paidKey), PAID_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [paidKey])

  if (status.kind === "starting") return <main className="h-dvh bg-brand" />
  if (status.kind === "pairing") return <Pairing code={status.code} />

  const shown = state.view === "paid" && expired === paidKey ? IDLE : state
  return (
    <>
      {shown.view === "cart" ? (
        <Bill state={shown} />
      ) : shown.view === "paid" ? (
        <Paid state={shown} />
      ) : (
        <Welcome outlet={outlet} />
      )}
      {status.kind === "offline" && (
        <p className="fixed right-4 bottom-4 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm text-white">
          <WifiOffIcon className="size-4" />
          {t("display.reconnecting")}
        </p>
      )}
    </>
  )
}
