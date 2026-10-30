import { Link } from "@tanstack/react-router"
import {
  BanknoteIcon,
  CameraIcon,
  HistoryIcon,
  PackagePlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { pageByKey } from "@/features/auth/lib/page-catalog.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { useProductsQuery } from "@/features/catalog/api/catalog.ts"
import type { Product } from "@/features/catalog/schemas/catalog.ts"
import type { PayMethod } from "@/features/checkout/api/checkout.ts"
import { CashPanel } from "@/features/checkout/components/cash-panel.tsx"
import { PaidOverlay } from "@/features/checkout/components/paid-overlay.tsx"
import { useBillRules } from "@/features/outlet/hooks/use-bill-rules.ts"
import { useCurrentShiftQuery } from "@/features/shifts/api/shifts.ts"
import { useSell, useTodaySalesQuery } from "@/features/snackbar/api/sales.ts"
import {
  CameraScanSheet,
  cameraScanSupported,
} from "@/features/snackbar/components/camera-scan-sheet.tsx"
import {
  CounterCart,
  CounterTotals,
} from "@/features/snackbar/components/counter-cart.tsx"
import { useCounterCart } from "@/features/snackbar/store/cart.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { billTotals, formatIDR } from "@/lib/money.ts"
import { useScanner } from "@/lib/scanner.ts"
import { useDebouncedValue } from "@/lib/use-debounced-value.ts"
import { cn } from "@/lib/utils.ts"

let audio: AudioContext | null = null

/** A short beep: high when a scan lands, low when it doesn't. Counters are loud; staff listen, not look. */
function beep(ok: boolean) {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = ok ? 1_760 : 330
    gain.gain.setValueAtTime(0.08, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12)
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.12)
  } catch {
    // No audio (autoplay rules, older browsers): the screen still shows it.
  }
  navigator.vibrate?.(ok ? 20 : [40, 40, 40])
}

const time = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})

function ProductTile({
  product,
  onPick,
}: {
  product: Product
  onPick: () => void
}) {
  const { t } = useTranslation()
  const soldOut = !product.is_available
  return (
    <Pressable
      onClick={onPick}
      disabled={soldOut}
      className="relative flex flex-col overflow-hidden rounded-2xl bg-card text-left shadow-(--shadow-soft) disabled:opacity-50"
    >
      <ProductImage
        src={product.image_url}
        alt=""
        className="aspect-[4/3] w-full"
      />
      {soldOut && (
        <span className="absolute top-2 left-2 rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">
          {t("order.soldOut")}
        </span>
      )}
      <span className="flex flex-1 flex-col gap-0.5 p-2.5">
        <span className="line-clamp-2 text-sm leading-tight font-medium">
          {product.name}
        </span>
        <span className="mt-auto font-heading font-semibold tabular-nums">
          {formatIDR(product.price)}
        </span>
      </span>
    </Pressable>
  )
}

function HistorySheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const sales = useTodaySalesQuery()
  const total = sales.data?.reduce((sum, sale) => sum + sale.paid, 0) ?? 0
  return (
    <TouchSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      side="center"
      title={t("snackbar.today")}
      description={t("snackbar.todaySummary", {
        count: sales.data?.length ?? 0,
        total: formatIDR(total),
      })}
    >
      <ul className="space-y-2">
        {sales.data?.map((sale) => (
          <li
            key={sale.id}
            className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3"
          >
            <span className="font-heading font-semibold">#{sale.number}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {sale.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
            </span>
            <span className="text-xs text-muted-foreground">
              {time.format(
                new Date(sale.payments.at(-1)?.created_at ?? sale.created_at)
              )}
            </span>
            <span className="font-medium tabular-nums">
              {formatIDR(sale.paid)}
            </span>
          </li>
        ))}
        {sales.data?.length === 0 && (
          <li className="text-sm text-muted-foreground">
            {t("snackbar.noSales")}
          </li>
        )}
      </ul>
    </TouchSheet>
  )
}

export function SnackbarPage() {
  const { t } = useTranslation()
  const retail = useProductsQuery("retail")
  const menu = useProductsQuery("menu")
  const shift = useCurrentShiftQuery()
  const rules = useBillRules()
  const sell = useSell()
  const canOpenShift = useCan(perm.openShift)
  const canAddProduct = useCan(perm.manageSettings)
  const { saleId, lines, touched, add, setQuantity, remove, clear } =
    useCounterCart()

  const [tab, setTab] = useState<"retail" | "menu">("retail")
  const [search, setSearch] = useState("")
  const [unknown, setUnknown] = useState<{ code: string; at: number } | null>(
    null
  )
  const [paying, setPaying] = useState(false)
  const [tendered, setTendered] = useState("")
  const [method, setMethod] = useState<PayMethod>("cash")
  const [camera, setCamera] = useState(false)
  const [history, setHistory] = useState(false)
  const [result, setResult] = useState<{ change: number } | null>(null)

  // Anything sold at the counter: retail goods, and menu items with no choices to make.
  const sellable = useMemo(
    () => [
      ...(retail.data ?? []),
      ...(menu.data ?? []).filter((p) => p.modifier_groups.length === 0),
    ],
    [retail.data, menu.data]
  )

  const scan = (raw: string) => {
    const code = raw.trim()
    const product = sellable.find((p) => p.barcode === code)
    if (!product) {
      beep(false)
      setUnknown({ code, at: Date.now() })
      return false
    }
    if (!product.is_available) {
      beep(false)
      toast.error(t("snackbar.soldOut", { name: product.name }))
      return true
    }
    beep(true)
    setUnknown(null)
    add(product)
    return true
  }

  useScanner(scan, !paying && !camera && result === null)

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const taxable = lines
    .filter((l) => l.tax_category === "pbjt")
    .reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const bill = billTotals(subtotal, 0, rules, { service: false, taxable })

  const typed = search.trim().toLowerCase()
  // Filter once typing pauses (a scanner's Enter is handled on submit, below).
  const query = useDebouncedValue(typed, 300)
  const searching = typed !== query
  const shown = (tab === "retail" ? retail.data : menu.data)
    ?.filter((p) => tab === "retail" || p.modifier_groups.length === 0)
    .filter(
      (p) =>
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.barcode?.includes(query)
    )

  const submit = async () => {
    try {
      const order = await sell.mutateAsync({
        id: saleId,
        method,
        tendered: method === "cash" ? Number(tendered) : 0,
        lines: lines.map((l) => ({
          id: l.id,
          product: l.product,
          quantity: l.quantity,
        })),
      })
      setPaying(false)
      setResult({ change: order.payments.at(-1)?.change ?? 0 })
      setTendered("")
      clear()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const loading = retail.isPending || menu.isPending

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-h-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
          <StatusPill tone="success" pulse>
            {t("snackbar.ready")}
          </StatusPill>
          <form
            className="relative min-w-56 flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              // A scanner aimed at the search box, or a barcode typed by hand.
              if (typed && /^\d{6,}$/.test(typed) && scan(typed)) setSearch("")
            }}
          >
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("snackbar.search")}
              aria-label={t("snackbar.search")}
              className="h-12 rounded-xl pl-11 text-base"
            />
          </form>
          {cameraScanSupported && (
            <Button
              variant="secondary"
              size="touch"
              onClick={() => setCamera(true)}
            >
              <CameraIcon />
              {t("snackbar.camera")}
            </Button>
          )}
          <Button variant="ghost" size="touch" onClick={() => setHistory(true)}>
            <HistoryIcon />
            {t("snackbar.today")}
          </Button>
        </header>

        <AnimatePresence>
          {unknown && (
            <motion.div
              key={unknown.at}
              role="alert"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: "auto",
                opacity: 1,
                x: [0, -10, 10, -6, 6, 0],
              }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ x: { duration: 0.4 }, default: { duration: 0.2 } }}
              className="shrink-0 overflow-hidden"
            >
              <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-danger/12 px-4 py-3 text-danger-ink">
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {t("snackbar.unknown", { code: unknown.code })}
                </span>
                {canAddProduct && (
                  <Button asChild size="sm" variant="secondary">
                    <Link to={pageByKey("menu").path}>
                      <PackagePlusIcon />
                      {t("snackbar.addProduct")}
                    </Link>
                  </Button>
                )}
                <button
                  type="button"
                  aria-label={t("common.close")}
                  onClick={() => setUnknown(null)}
                  className="grid size-9 place-items-center rounded-lg"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="shrink-0 px-4 pt-3">
          <Segmented
            label={t("snackbar.tabs")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "retail", label: t("snackbar.tabRetail") },
              { value: "menu", label: t("snackbar.tabMenu") },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {loading || searching ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          ) : shown?.length ? (
            <div
              key={`${tab}:${query}`}
              className="rise-in grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3"
            >
              {shown.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  onPick={() => {
                    add(product)
                    setUnknown(null)
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-muted-foreground">
              {t("snackbar.noMatch")}
            </p>
          )}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col border-l bg-background/60">
        <CounterCart
          lines={lines}
          touched={touched}
          onQuantity={setQuantity}
          onRemove={remove}
          onClear={clear}
        />
        <div className="shrink-0 space-y-3 border-t bg-card/90 p-4 backdrop-blur">
          <CounterTotals bill={bill} pbjtPercent={rules.pbjtPercent} />
          <Button
            size="xl"
            className={cn("w-full")}
            disabled={lines.length === 0}
            onClick={() => setPaying(true)}
          >
            <BanknoteIcon />
            {t("checkout.payFrom", { amount: formatIDR(bill.total) })}
          </Button>
        </div>
      </aside>

      <TouchSheet
        open={paying}
        onOpenChange={(open) => {
          setPaying(open)
          if (!open) {
            setTendered("")
            setMethod("cash")
          }
        }}
        side="center"
        title={t("snackbar.payTitle", { count: lines.length })}
        className="w-[min(46rem,calc(100vw-2rem))]"
      >
        <div className="-mx-6 -mb-6">
          <CashPanel
            due={bill.total}
            tendered={tendered}
            onTendered={setTendered}
            method={method}
            onMethod={setMethod}
            blocked={null}
            noShift={shift.isSuccess && shift.data === null}
            canOpenShift={canOpenShift}
            paying={sell.isPending}
            onPay={() => void submit()}
            wide
          />
        </div>
      </TouchSheet>

      <CameraScanSheet
        open={camera}
        onClose={() => setCamera(false)}
        onScan={scan}
      />
      <HistorySheet open={history} onClose={() => setHistory(false)} />
      <AnimatePresence>
        {result && (
          <PaidOverlay
            change={result.change}
            remaining={0}
            doneLabel={t("snackbar.nextCustomer")}
            onDone={() => setResult(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
