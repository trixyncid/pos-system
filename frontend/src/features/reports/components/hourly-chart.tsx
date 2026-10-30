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
import { formatIDR } from "@/lib/money.ts"

/** Opening hours always show, so a quiet morning reads as quiet rather than missing. */
const OPEN = 9
const CLOSE = 22

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-(--shadow-raised)">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-heading font-semibold tabular-nums">
        {formatIDR(payload[0]!.value)}
      </p>
    </div>
  )
}

/** Sales by the hour the bill was paid: one series, so no legend; the card title names it. */
export function HourlyChart({ hourly }: { hourly: number[] }) {
  const { t } = useTranslation()
  const first = Math.min(
    OPEN,
    hourly.findIndex((v) => v > 0) === -1
      ? OPEN
      : hourly.findIndex((v) => v > 0)
  )
  const lastSale = hourly.findLastIndex((v) => v > 0)
  const last = Math.max(CLOSE, lastSale)
  const data = hourly.slice(first, last + 1).map((sales, i) => ({
    hour: `${String(first + i).padStart(2, "0")}.00`,
    sales,
  }))

  return (
    <div className="h-60" role="img" aria-label={t("dashboard.hourlyLabel")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={false}
            interval={1}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={compactIDR}
            tickLine={false}
            axisLine={false}
            width={48}
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
            maxBarSize={36}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
