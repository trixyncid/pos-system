import { Link } from "@tanstack/react-router"
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ReceiptIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { CountUp } from "@/components/motion/count-up.tsx"
import { RiseIn } from "@/components/motion/rise-in.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { pageByKey } from "@/features/auth/lib/page-catalog.ts"
import { useDashboardQuery } from "@/features/reports/api/reports.ts"
import { ChannelSplit } from "@/features/reports/components/channel-split.tsx"
import { Delta } from "@/features/reports/components/delta.tsx"
import { HourlyChart } from "@/features/reports/components/hourly-chart.tsx"
import { RankedList } from "@/features/reports/components/ranked-list.tsx"
import type { Dashboard } from "@/features/reports/schemas/reports.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { addDays, parseIsoDate, today } from "@/lib/dates.ts"
import { formatIDR } from "@/lib/money.ts"
import { cn } from "@/lib/utils.ts"

const dayName = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

function Card({
  title,
  action,
  children,
  className,
  delay = 0,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <RiseIn
      delay={delay}
      className={cn(
        "rounded-3xl bg-card p-5 shadow-(--shadow-soft)",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-heading font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </RiseIn>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  format,
  footer,
  delay,
}: {
  icon: LucideIcon
  label: string
  value: number
  format: (n: number) => string
  footer?: ReactNode
  delay: number
}) {
  return (
    <RiseIn
      delay={delay}
      className="rounded-3xl bg-card p-5 shadow-(--shadow-soft)"
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-semibold whitespace-nowrap tabular-nums xl:text-3xl">
        <CountUp value={value} format={format} />
      </p>
      {footer && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{footer}</div>
      )}
    </RiseIn>
  )
}

const count = (n: number) => String(Math.round(n))

function Body({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const inventory = pageByKey("inventory").path
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={WalletIcon}
          label={t("dashboard.sales")}
          value={data.sales}
          format={formatIDR}
          delay={0}
          footer={
            <>
              <Delta
                now={data.sales}
                before={data.yesterday.sales}
                label={t(
                  data.yesterday.partial
                    ? "dashboard.vsYesterdaySoFar"
                    : "dashboard.vsYesterday"
                )}
              />
              <Delta
                now={data.sales}
                before={data.last_week.sales}
                label={t(
                  data.last_week.partial
                    ? "dashboard.vsLastWeekSoFar"
                    : "dashboard.vsLastWeek"
                )}
              />
            </>
          }
        />
        <Kpi
          icon={ReceiptIcon}
          label={t("dashboard.orders")}
          value={data.orders}
          format={count}
          delay={0.04}
          footer={
            <Delta
              now={data.orders}
              before={data.yesterday.orders}
              label={t(
                data.yesterday.partial
                  ? "dashboard.vsYesterdaySoFar"
                  : "dashboard.vsYesterday"
              )}
            />
          }
        />
        <Kpi
          icon={WalletIcon}
          label={t("dashboard.averageTicket")}
          value={data.average_ticket}
          format={formatIDR}
          delay={0.08}
        />
        <Kpi
          icon={UsersIcon}
          label={t("dashboard.covers")}
          value={data.covers}
          format={count}
          delay={0.12}
          footer={
            data.table_turns !== null && (
              <span className="text-xs text-muted-foreground">
                {t("dashboard.tableTurns", {
                  turns: data.table_turns.toLocaleString("id-ID"),
                })}
              </span>
            )
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title={t("dashboard.byHour")}
          className="lg:col-span-2"
          delay={0.1}
        >
          {data.sales > 0 ? (
            <HourlyChart hourly={data.hourly} />
          ) : (
            <p className="grid h-60 place-items-center text-sm text-muted-foreground">
              {t("dashboard.noSales")}
            </p>
          )}
        </Card>
        <Card title={t("dashboard.channels")} delay={0.14}>
          <ChannelSplit channels={data.channels} />
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
            <div>
              <dt className="text-muted-foreground">
                {t("dashboard.foodCost")}
              </dt>
              <dd
                className={cn(
                  "font-heading text-xl font-semibold tabular-nums",
                  (data.food_cost_percent ?? 0) > 35 && "text-warning-ink"
                )}
              >
                {data.food_cost_percent === null
                  ? "—"
                  : `${data.food_cost_percent.toLocaleString("id-ID")}%`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("dashboard.net")}</dt>
              <dd className="font-heading text-lg font-semibold whitespace-nowrap">
                <MoneyText amount={data.net} />
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("dashboard.topItems")} delay={0.18}>
          <RankedList
            rows={data.top_items}
            value={(row) => row.revenue}
            label={(row) => row.name}
            detail={(row) => `${row.quantity}×`}
            amount={(row) => formatIDR(row.revenue)}
            empty={t("dashboard.noSales")}
          />
        </Card>
        <Card title={t("dashboard.waiters")} delay={0.22}>
          <RankedList
            rows={data.waiters}
            value={(row) => row.sales}
            label={(row) => row.name}
            detail={(row) => t("dashboard.ordersCount", { count: row.orders })}
            amount={(row) => formatIDR(row.sales)}
            empty={t("dashboard.noSales")}
          />
        </Card>
        <div className="space-y-4">
          <Card title={t("dashboard.voidsDiscounts")} delay={0.26}>
            <ul className="space-y-2 text-sm">
              {data.voids.map((row) => (
                <li
                  key={`v-${row.name}`}
                  className="flex items-start justify-between gap-2"
                >
                  <span className="min-w-0">
                    {t("dashboard.voids", { count: row.count })}
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.name}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-danger-ink tabular-nums">
                    −{formatIDR(row.amount)}
                  </span>
                </li>
              ))}
              {data.discounts.map((row) => (
                <li
                  key={`d-${row.name}`}
                  className="flex items-start justify-between gap-2"
                >
                  <span className="min-w-0">
                    {t("dashboard.discounts", { count: row.count })}
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.name}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-warning-ink tabular-nums">
                    −{formatIDR(row.amount)}
                  </span>
                </li>
              ))}
              {data.voids.length + data.discounts.length === 0 && (
                <li className="text-muted-foreground">
                  {t("dashboard.noVoids")}
                </li>
              )}
            </ul>
          </Card>
          {data.low_stock > 0 && (
            <RiseIn delay={0.3}>
              <Link
                to={inventory}
                className="flex items-center gap-3 rounded-3xl bg-warning/15 p-5 text-warning-ink"
              >
                <AlertTriangleIcon className="size-5 shrink-0" />
                <span className="flex-1 font-medium">
                  {t("dashboard.lowStock", { count: data.low_stock })}
                </span>
                <ChevronRightIcon className="size-5" />
              </Link>
            </RiseIn>
          )}
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const [date, setDate] = useState(today)
  const dashboard = useDashboardQuery(date)
  const isToday = date === today()

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title={t("dashboard.title")}
        description={
          isToday ? t("dashboard.today") : dayName.format(parseIsoDate(date))
        }
        actions={
          <div className="flex items-center gap-1 rounded-2xl bg-card p-1 shadow-(--shadow-soft)">
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label={t("dashboard.previousDay")}
              onClick={() => setDate((d) => addDays(d, -1))}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium">
              {isToday
                ? t("dashboard.todayShort")
                : dayName.format(parseIsoDate(date))}
            </span>
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label={t("dashboard.nextDay")}
              disabled={isToday}
              onClick={() => setDate((d) => addDays(d, 1))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        }
      />
      {dashboard.isPending ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : dashboard.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(dashboard.error)}</p>
      ) : (
        <div
          className={cn(
            "transition-opacity",
            dashboard.isPlaceholderData && "opacity-60"
          )}
        >
          <Body data={dashboard.data} />
        </div>
      )}
    </div>
  )
}
