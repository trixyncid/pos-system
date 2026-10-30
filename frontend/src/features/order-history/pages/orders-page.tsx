import { ChevronRightIcon, ReceiptTextIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Pager } from "@/components/backoffice/pager.tsx"
import { Pressable } from "@/components/motion/pressable.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import {
  useOrderHistoryQuery,
  type HistoryParams,
} from "@/features/order-history/api/history.ts"
import { OrderDetailSheet } from "@/features/order-history/components/order-detail-sheet.tsx"
import {
  orderLabel,
  statusTone,
} from "@/features/order-history/components/order-label.ts"
import type {
  HistoryStatus,
  OrderRow,
} from "@/features/order-history/schemas/history.ts"
import type { Range } from "@/features/reports/api/reports.ts"
import { DateRangePicker } from "@/features/reports/components/date-range-picker.tsx"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { today } from "@/lib/dates.ts"
import { useDebouncedValue } from "@/lib/use-debounced-value.ts"
import { cn } from "@/lib/utils.ts"

const time = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function OrderRowCard({ row, onOpen }: { row: OrderRow; onOpen: () => void }) {
  const { t } = useTranslation()
  const settled = row.status === "paid" || row.status === "refunded"
  return (
    <li>
      <Pressable
        pressScale={0.99}
        onClick={onOpen}
        className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto_auto] items-center gap-4 rounded-2xl bg-card px-4 py-3 text-left shadow-(--shadow-soft)"
      >
        <span className="font-heading text-lg font-semibold tabular-nums">
          #{row.number}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{orderLabel(row, t)}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {time.format(new Date(row.created_at))} · {row.waiter}
            </span>
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {row.summary || t("history.noItems")}
          </span>
        </span>
        <span className="text-right">
          <MoneyText
            amount={settled ? row.paid : row.total}
            className={cn(
              "block font-heading font-semibold",
              row.status === "refunded" && "line-through opacity-60"
            )}
          />
          <span className="block text-xs text-muted-foreground">
            {t("history.items", { count: row.items })}
            {row.promo_name && ` · ${row.promo_name}`}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <StatusPill
            tone={statusTone[row.status]}
            className="w-24 justify-center"
          >
            {t(`history.status.${row.status}`)}
          </StatusPill>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </span>
      </Pressable>
    </li>
  )
}

const STATUSES = ["all", "open", "paid", "void", "refunded"] as const

/** Every order of the day (or a range), restaurant and snack bar, to look up, reprint, continue or refund. */
export function OrdersPage() {
  const { t } = useTranslation()
  const [range, setRange] = useState<Range>(() => ({
    from: today(),
    to: today(),
  }))
  const [channel, setChannel] = useState<"all" | "restaurant" | "snackbar">(
    "all"
  )
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<OrderRow | null>(null)
  const query = useDebouncedValue(search.trim(), 300)

  const params: HistoryParams = {
    ...range,
    channel: channel === "all" ? undefined : channel,
    status: status === "all" ? undefined : (status as HistoryStatus),
    search: query || undefined,
    page,
  }
  const orders = useOrderHistoryQuery(params)
  const reset = () => setPage(1)

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-5xl space-y-5 p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold">
              {t("history.title")}
            </h1>
            <p className="text-muted-foreground">{t("history.subtitle")}</p>
          </div>
          <DateRangePicker
            value={range}
            onChange={(next) => {
              setRange(next)
              reset()
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                reset()
              }}
              placeholder={t("history.search")}
              aria-label={t("history.search")}
              className="h-12 rounded-xl pl-12 text-base"
            />
          </div>
          <Segmented
            label={t("history.channel")}
            value={channel}
            onChange={(next) => {
              setChannel(next)
              reset()
            }}
            options={[
              { value: "all", label: t("history.all") },
              { value: "restaurant", label: t("dashboard.channel.restaurant") },
              { value: "snackbar", label: t("dashboard.channel.snackbar") },
            ]}
          />
        </div>
        <Segmented
          label={t("history.statusLabel")}
          value={status}
          onChange={(next) => {
            setStatus(next)
            reset()
          }}
          options={STATUSES.map((value) => ({
            value,
            label:
              value === "all" ? t("history.all") : t(`history.filter.${value}`),
          }))}
        />

        {orders.isPending || search.trim() !== query ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-18 rounded-2xl" />
            ))}
          </div>
        ) : orders.isError ? (
          <p className="text-danger-ink">{apiErrorMessage(orders.error)}</p>
        ) : orders.data.results.length === 0 ? (
          <div className="space-y-3 py-16 text-center text-muted-foreground">
            <ReceiptTextIcon className="mx-auto size-10 opacity-40" />
            <p>{t("history.empty")}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("history.count", { count: orders.data.count })}
            </p>
            <ul
              className={cn(
                "rise-in space-y-2 transition-opacity",
                orders.isPlaceholderData && "opacity-60"
              )}
            >
              {orders.data.results.map((row) => (
                <OrderRowCard
                  key={row.id}
                  row={row}
                  onOpen={() => setOpen(row)}
                />
              ))}
            </ul>
            <Pager
              page={page}
              hasPrevious={Boolean(orders.data.previous)}
              hasNext={Boolean(orders.data.next)}
              onPage={setPage}
            />
          </>
        )}
      </div>
      <OrderDetailSheet order={open} onClose={() => setOpen(null)} />
    </div>
  )
}
