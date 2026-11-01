import { DownloadIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { RiseIn } from "@/components/motion/rise-in.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import {
  useItemsReportQuery,
  useSalesReportQuery,
  type Range,
} from "@/features/reports/api/reports.ts"
import { DailyChart } from "@/features/reports/components/daily-chart.tsx"
import {
  DateRangePicker,
  presets,
} from "@/features/reports/components/date-range-picker.tsx"
import type { ItemRow, SalesDay } from "@/features/reports/schemas/reports.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { downloadCsv } from "@/lib/csv.ts"
import { isoDate, parseIsoDate } from "@/lib/dates.ts"
import { formatIDR } from "@/lib/money.ts"
import { cn } from "@/lib/utils.ts"
import i18n, { localeTag } from "@/lib/i18n.ts"
import { dateFormat } from "@/lib/locale-format.ts"

const day = dateFormat({
  weekday: "short",
  day: "numeric",
  month: "short",
})
const percent = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString(localeTag(i18n.language))}%`

function sum(rows: SalesDay[]) {
  const total = rows.reduce(
    (acc, row) => ({
      orders: acc.orders + row.orders,
      covers: acc.covers + row.covers,
      gross: acc.gross + row.gross,
      discount: acc.discount + row.discount,
      service: acc.service + row.service,
      tax: acc.tax + row.tax,
      sales: acc.sales + row.sales,
      net: acc.net + row.net,
      cost: acc.cost + row.cost,
    }),
    {
      orders: 0,
      covers: 0,
      gross: 0,
      discount: 0,
      service: 0,
      tax: 0,
      sales: 0,
      net: 0,
      cost: 0,
    }
  )
  return {
    ...total,
    food_cost_percent: total.net
      ? Math.round((total.cost / total.net) * 1_000) / 10
      : null,
    average_ticket: total.orders ? Math.round(total.sales / total.orders) : 0,
  }
}

const th = "px-3 py-2 text-right font-medium whitespace-nowrap"
const td = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap"

function SalesTable({ rows }: { rows: SalesDay[] }) {
  const { t } = useTranslation()
  const total = sum(rows)
  return (
    <div className="overflow-x-auto rounded-3xl bg-card shadow-(--shadow-soft)">
      <table className="w-full text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className={cn(th, "text-left")}>{t("reports.date")}</th>
            <th className={th}>{t("reports.orders")}</th>
            <th className={th}>{t("reports.covers")}</th>
            <th className={th}>{t("reports.gross")}</th>
            <th className={th}>{t("reports.discount")}</th>
            <th className={th}>{t("reports.service")}</th>
            <th className={th}>{t("reports.tax")}</th>
            <th className={th}>{t("reports.sales")}</th>
            <th className={th}>{t("reports.foodCost")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...rows].reverse().map((row) => (
            <tr
              key={row.date}
              className={cn(row.orders === 0 && "text-muted-foreground")}
            >
              <td className={cn(td, "text-left")}>
                {day.format(parseIsoDate(row.date))}
              </td>
              <td className={td}>{row.orders}</td>
              <td className={td}>{row.covers}</td>
              <td className={td}>{formatIDR(row.gross)}</td>
              <td className={td}>
                {row.discount ? `−${formatIDR(row.discount)}` : "—"}
              </td>
              <td className={td}>{formatIDR(row.service)}</td>
              <td className={td}>{formatIDR(row.tax)}</td>
              <td className={cn(td, "font-medium")}>{formatIDR(row.sales)}</td>
              <td className={td}>{percent(row.food_cost_percent)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 font-semibold">
          <tr>
            <td className={cn(td, "text-left")}>{t("reports.total")}</td>
            <td className={td}>{total.orders}</td>
            <td className={td}>{total.covers}</td>
            <td className={td}>{formatIDR(total.gross)}</td>
            <td className={td}>
              {total.discount ? `−${formatIDR(total.discount)}` : "—"}
            </td>
            <td className={td}>{formatIDR(total.service)}</td>
            <td className={td}>{formatIDR(total.tax)}</td>
            <td className={td}>{formatIDR(total.sales)}</td>
            <td className={td}>{percent(total.food_cost_percent)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ItemsTable({ rows }: { rows: ItemRow[] }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto rounded-3xl bg-card shadow-(--shadow-soft)">
      <table className="w-full text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className={cn(th, "text-left")}>{t("reports.item")}</th>
            <th className={th}>{t("reports.restaurant")}</th>
            <th className={th}>{t("reports.snackbar")}</th>
            <th className={th}>{t("reports.revenue")}</th>
            <th className={th}>{t("reports.cost")}</th>
            <th className={th}>{t("reports.margin")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const margin =
              row.margin !== null && row.revenue
                ? Math.round((row.margin / row.revenue) * 100)
                : null
            return (
              <tr key={row.product}>
                <td
                  className={cn(td, "max-w-64 truncate text-left font-medium")}
                >
                  {row.name}
                </td>
                <td className={td}>{row.channel_restaurant || "—"}</td>
                <td className={td}>{row.channel_snackbar || "—"}</td>
                <td className={cn(td, "font-medium")}>
                  {formatIDR(row.revenue)}
                </td>
                <td className={td}>
                  {row.cost === null ? (
                    <span
                      className="text-xs text-muted-foreground"
                      title={t("reports.noRecipe")}
                    >
                      {t("reports.noRecipeShort")}
                    </span>
                  ) : (
                    formatIDR(row.cost)
                  )}
                </td>
                <td className={td}>
                  {row.margin === null || margin === null ? (
                    "—"
                  ) : (
                    <>
                      {formatIDR(row.margin)}{" "}
                      <span
                        className={cn(
                          "text-xs",
                          margin < 50
                            ? "text-warning-ink"
                            : "text-muted-foreground"
                        )}
                      >
                        {margin}%
                      </span>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-(--shadow-soft)">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold whitespace-nowrap tabular-nums xl:text-2xl">
        {value}
      </p>
    </div>
  )
}

export function ReportsPage() {
  const { t } = useTranslation()
  // The last 7 days until the owner picks another period.
  const [range, setRange] = useState<Range>(() => {
    const week = presets().find((preset) => preset.key === "last7")!
    return { from: isoDate(week.from), to: isoDate(week.to) }
  })
  const [tab, setTab] = useState<"sales" | "items">("sales")
  const sales = useSalesReportQuery(range)
  const items = useItemsReportQuery(range, tab === "items")

  const exportCsv = () => {
    const name = `${range.from}_${range.to}`
    if (tab === "sales" && sales.data)
      downloadCsv(`${t("reports.csv.salesFile")}_${name}.csv`, [
        [
          t("reports.date"),
          t("reports.orders"),
          t("reports.covers"),
          t("reports.gross"),
          t("reports.discount"),
          t("reports.service"),
          t("reports.tax"),
          t("reports.csv.rounding"),
          t("reports.sales"),
          t("reports.csv.net"),
          t("reports.csv.cost"),
          t("reports.csv.foodCostPercent"),
        ],
        ...sales.data.rows.map((row) => [
          row.date,
          row.orders,
          row.covers,
          row.gross,
          row.discount,
          row.service,
          row.tax,
          row.rounding,
          row.sales,
          row.net,
          row.cost,
          row.food_cost_percent,
        ]),
      ])
    if (tab === "items" && items.data)
      downloadCsv(`${t("reports.csv.itemsFile")}_${name}.csv`, [
        [
          t("reports.item"),
          t("reports.csv.kind"),
          t("reports.restaurant"),
          t("reports.snackbar"),
          t("reports.csv.quantity"),
          t("reports.revenue"),
          t("reports.csv.cost"),
          t("reports.margin"),
        ],
        ...items.data.rows.map((row) => [
          row.name,
          row.kind,
          row.channel_restaurant,
          row.channel_snackbar,
          row.quantity,
          row.revenue,
          row.cost,
          row.margin,
        ]),
      ])
  }

  const active = tab === "sales" ? sales : items
  const total = sales.data ? sum(sales.data.rows) : null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.subtitle")}
        actions={
          <Button
            size="touch"
            variant="secondary"
            disabled={!active.data}
            onClick={exportCsv}
          >
            <DownloadIcon />
            {t("reports.export")}
          </Button>
        }
      />

      <DateRangePicker value={range} onChange={setRange} />

      {total && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat label={t("reports.sales")} value={formatIDR(total.sales)} />
          <Stat label={t("reports.orders")} value={String(total.orders)} />
          <Stat
            label={t("dashboard.averageTicket")}
            value={formatIDR(total.average_ticket)}
          />
          <Stat
            label={t("reports.foodCost")}
            value={percent(total.food_cost_percent)}
          />
        </div>
      )}

      <Segmented
        label={t("reports.title")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "sales", label: t("reports.tabSales") },
          { value: "items", label: t("reports.tabItems") },
        ]}
      />

      {active.isPending ? (
        <Skeleton className="h-96 rounded-3xl" />
      ) : active.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(active.error)}</p>
      ) : (
        <div
          className={cn(
            "space-y-4 transition-opacity",
            active.isPlaceholderData && "opacity-60"
          )}
        >
          {tab === "sales" && sales.data && (
            <>
              <RiseIn className="rounded-3xl bg-card p-5 shadow-(--shadow-soft)">
                <h2 className="mb-4 font-heading font-semibold">
                  {t("reports.dailyTitle")}
                </h2>
                <DailyChart rows={sales.data.rows} />
              </RiseIn>
              <SalesTable rows={sales.data.rows} />
            </>
          )}
          {tab === "items" &&
            items.data &&
            (items.data.rows.length ? (
              <ItemsTable rows={items.data.rows} />
            ) : (
              <p className="py-16 text-center text-muted-foreground">
                {t("reports.empty")}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
