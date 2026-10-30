import { useTranslation } from "react-i18next"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { compactIDR } from "@/features/reports/lib/format.ts"
import type { SalesDay } from "@/features/reports/schemas/reports.ts"
import { parseIsoDate } from "@/lib/dates.ts"
import { formatIDR } from "@/lib/money.ts"

const short = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
})
const long = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
})

function Tip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: SalesDay }[]
}) {
  const { t } = useTranslation()
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-(--shadow-raised)">
      <p className="text-muted-foreground">
        {long.format(parseIsoDate(row.date))}
      </p>
      <p className="font-heading font-semibold tabular-nums">
        {formatIDR(row.sales)}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("dashboard.ordersCount", { count: row.orders })}
      </p>
    </div>
  )
}

/** Sales per day across the range: one series, the card title names it. */
export function DailyChart({ rows }: { rows: SalesDay[] }) {
  const { t } = useTranslation()
  return (
    <div className="h-64" role="img" aria-label={t("reports.dailyLabel")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => short.format(parseIsoDate(value))}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={compactIDR}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            content={<Tip />}
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          />
          <Bar
            dataKey="sales"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
