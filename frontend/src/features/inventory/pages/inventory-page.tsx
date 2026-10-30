import {
  AlertTriangleIcon,
  BoxesIcon,
  ClipboardCheckIcon,
  PackagePlusIcon,
  PackageXIcon,
  SearchIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useDeferredValue, useState } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { Pager } from "@/components/backoffice/pager.tsx"
import { CountUp } from "@/components/motion/count-up.tsx"
import { Pressable } from "@/components/motion/pressable.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import {
  useMovementsQuery,
  useStockQuery,
  useStockSummaryQuery,
  type MovementParams,
  type StockParams,
} from "@/features/inventory/api/inventory.ts"
import { CountSheet } from "@/features/inventory/components/count-sheet.tsx"
import { ItemSheet } from "@/features/inventory/components/item-sheet.tsx"
import { MovementList } from "@/features/inventory/components/movement-list.tsx"
import { ReceiveSheet } from "@/features/inventory/components/receive-sheet.tsx"
import { StockBar } from "@/features/inventory/components/stock-bar.tsx"
import { WasteSheet } from "@/features/inventory/components/waste-sheet.tsx"
import { formatQuantity } from "@/features/inventory/lib/quantity.ts"
import { statusTone } from "@/features/inventory/lib/tones.ts"
import type { StockItem } from "@/features/inventory/schemas/inventory.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

function Kpi({
  icon: Icon,
  label,
  value,
  format = (n) => String(Math.round(n)),
  tone,
  onClick,
  active,
}: {
  icon: LucideIcon
  label: string
  value: number | undefined
  format?: (n: number) => string
  tone?: "warning" | "danger"
  onClick?: () => void
  active?: boolean
}) {
  return (
    <Pressable
      pressScale={onClick ? 0.97 : 1}
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "rounded-2xl border-2 border-transparent bg-card p-4 text-left shadow-(--shadow-soft) transition-colors disabled:cursor-default",
        active && "border-primary"
      )}
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon
          className={cn(
            "size-4",
            tone === "warning" && "text-warning-ink",
            tone === "danger" && "text-danger-ink"
          )}
        />
        {label}
      </span>
      <span className="mt-1 block font-heading text-2xl font-semibold whitespace-nowrap tabular-nums">
        {value === undefined ? "—" : <CountUp value={value} format={format} />}
      </span>
    </Pressable>
  )
}

function StockRow({ item, onOpen }: { item: StockItem; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring.layout}
    >
      <Pressable
        pressScale={0.99}
        onClick={onOpen}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_10rem_7rem] items-center gap-4 rounded-2xl bg-card px-4 py-3 text-left shadow-(--shadow-soft)"
      >
        <ProductImage
          src={item.image_url}
          alt=""
          className="size-11 rounded-xl"
        />
        <span className="min-w-0">
          <span className="block truncate font-medium">{item.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {item.kind === "ingredient"
              ? t("inventory.ingredient")
              : (item.category_name ?? t("inventory.good"))}
            {item.sku && ` · ${item.sku}`}
          </span>
        </span>
        <span className="space-y-1.5">
          <span className="flex items-center justify-between gap-2">
            <span className="font-heading font-semibold tabular-nums">
              {formatQuantity(item.stock, item.unit)}
            </span>
            {item.status !== "ok" && (
              <StatusPill tone={statusTone[item.status]}>
                {t(`inventory.status.${item.status}`)}
              </StatusPill>
            )}
          </span>
          <StockBar
            stock={item.stock}
            threshold={item.low_stock_threshold}
            status={item.status}
          />
        </span>
        <MoneyText
          amount={item.value}
          className="text-right text-sm text-muted-foreground"
        />
      </Pressable>
    </motion.li>
  )
}

function StockTab({
  status,
  onOpen,
}: {
  status: StockParams["status"]
  onOpen: (item: StockItem) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<"all" | "ingredient" | "retail">("all")
  const [page, setPage] = useState(1)
  const params: StockParams = {
    search: useDeferredValue(search.trim()) || undefined,
    kind: kind === "all" ? undefined : kind,
    status,
    page,
  }
  const stock = useStockQuery(params)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t("inventory.search")}
            aria-label={t("inventory.search")}
            className="h-12 rounded-xl pl-12 text-base"
          />
        </div>
        <Segmented
          label={t("inventory.kind")}
          value={kind}
          onChange={(next) => {
            setKind(next)
            setPage(1)
          }}
          options={[
            { value: "all", label: t("inventory.all") },
            { value: "ingredient", label: t("inventory.ingredients") },
            { value: "retail", label: t("inventory.goods") },
          ]}
        />
      </div>
      {stock.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-17 rounded-2xl" />
          ))}
        </div>
      ) : stock.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(stock.error)}</p>
      ) : stock.data.results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {t("inventory.empty")}
        </p>
      ) : (
        <>
          <ul
            className={cn(
              "space-y-2 transition-opacity",
              stock.isPlaceholderData && "opacity-60"
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {stock.data.results.map((item) => (
                <StockRow
                  key={item.id}
                  item={item}
                  onOpen={() => onOpen(item)}
                />
              ))}
            </AnimatePresence>
          </ul>
          <Pager
            page={page}
            hasPrevious={Boolean(stock.data.previous)}
            hasNext={Boolean(stock.data.next)}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}

const LEDGER_KINDS = ["all", "sale", "receive", "waste", "count"] as const

function LedgerTab() {
  const { t } = useTranslation()
  const [kind, setKind] = useState<(typeof LEDGER_KINDS)[number]>("all")
  const [page, setPage] = useState(1)
  const params: MovementParams = {
    kind: kind === "all" ? undefined : kind,
    page,
  }
  const movements = useMovementsQuery(params)

  return (
    <div className="space-y-4">
      <Segmented
        label={t("inventory.kind")}
        value={kind}
        onChange={(next) => {
          setKind(next)
          setPage(1)
        }}
        options={LEDGER_KINDS.map((value) => ({
          value,
          label:
            value === "all"
              ? t("inventory.all")
              : t(`inventory.kinds.${value}`),
        }))}
      />
      {movements.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : movements.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(movements.error)}</p>
      ) : movements.data.results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {t("inventory.noMovements")}
        </p>
      ) : (
        <>
          <div
            className={cn(
              "transition-opacity",
              movements.isPlaceholderData && "opacity-60"
            )}
          >
            <MovementList movements={movements.data.results} />
          </div>
          <Pager
            page={page}
            hasPrevious={Boolean(movements.data.previous)}
            hasNext={Boolean(movements.data.next)}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}

export function InventoryPage() {
  const { t } = useTranslation()
  const summary = useStockSummaryQuery()
  const [tab, setTab] = useState<"stock" | "ledger">("stock")
  const [status, setStatus] = useState<StockParams["status"]>(undefined)
  const [open, setOpen] = useState<StockItem | null>(null)
  const [receiving, setReceiving] = useState<{
    preset: StockItem | null
  } | null>(null)
  const [wasting, setWasting] = useState<StockItem | null>(null)
  const [counting, setCounting] = useState(false)

  const filterBy = (next: StockParams["status"]) => {
    setTab("stock")
    setStatus((current) => (current === next ? undefined : next))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.subtitle")}
        actions={
          <>
            <Button
              size="touch"
              variant="secondary"
              onClick={() => setCounting(true)}
            >
              <ClipboardCheckIcon />
              {t("inventory.count")}
            </Button>
            <Button size="touch" onClick={() => setReceiving({ preset: null })}>
              <PackagePlusIcon />
              {t("inventory.receive")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          icon={BoxesIcon}
          label={t("inventory.tracked")}
          value={summary.data?.tracked}
          onClick={() => filterBy(undefined)}
          active={tab === "stock" && status === undefined}
        />
        <Kpi
          icon={AlertTriangleIcon}
          tone="warning"
          label={t("inventory.status.low")}
          value={summary.data?.low}
          onClick={() => filterBy("low")}
          active={tab === "stock" && status === "low"}
        />
        <Kpi
          icon={PackageXIcon}
          tone="danger"
          label={t("inventory.status.out")}
          value={summary.data?.out}
          onClick={() => filterBy("out")}
          active={tab === "stock" && status === "out"}
        />
        <Kpi
          icon={WalletIcon}
          label={t("inventory.stockValue")}
          value={summary.data?.value}
          format={formatIDR}
        />
      </div>

      <Segmented
        label={t("inventory.title")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "stock", label: t("inventory.tabStock") },
          { value: "ledger", label: t("inventory.tabLedger") },
        ]}
      />

      {tab === "stock" ? (
        <StockTab key={status ?? "all"} status={status} onOpen={setOpen} />
      ) : (
        <LedgerTab />
      )}

      <ItemSheet
        item={open}
        onClose={() => setOpen(null)}
        onReceive={(item) => {
          setOpen(null)
          setReceiving({ preset: item })
        }}
        onWaste={(item) => {
          setOpen(null)
          setWasting(item)
        }}
      />
      <ReceiveSheet
        open={receiving !== null}
        preset={receiving?.preset ?? null}
        onClose={() => setReceiving(null)}
      />
      <WasteSheet item={wasting} onClose={() => setWasting(null)} />
      <CountSheet open={counting} onClose={() => setCounting(false)} />
    </div>
  )
}
