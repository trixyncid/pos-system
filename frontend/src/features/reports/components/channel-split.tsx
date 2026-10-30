import { motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { MoneyText } from "@/components/pos/money-text.tsx"
import type { Dashboard } from "@/features/reports/schemas/reports.ts"

const CHANNELS = [
  { key: "restaurant", color: "var(--chart-1)" },
  { key: "snackbar", color: "var(--chart-3)" },
] as const

/**
 * Restaurant against snack bar as one split bar, labelled directly below
 * (name, share and amount), so the colours are never the only key.
 */
export function ChannelSplit({
  channels,
}: {
  channels: Dashboard["channels"]
}) {
  const { t } = useTranslation()
  const total = channels.restaurant.sales + channels.snackbar.sales
  return (
    <div className="space-y-4">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-muted">
        {total > 0 &&
          CHANNELS.map(({ key, color }) => (
            <motion.div
              key={key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${(channels[key].sales / total) * 100}%` }}
              transition={{ type: "spring", stiffness: 140, damping: 24 }}
            />
          ))}
      </div>
      <ul className="space-y-3">
        {CHANNELS.map(({ key, color }) => {
          const figures = channels[key]
          const share = total ? Math.round((figures.sales / total) * 100) : 0
          return (
            <li key={key} className="flex items-start gap-3">
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t(`dashboard.channel.${key}`)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {share}% ·{" "}
                  {t("dashboard.ordersCount", { count: figures.orders })}
                </p>
              </div>
              <MoneyText
                amount={figures.sales}
                className="font-medium whitespace-nowrap"
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
