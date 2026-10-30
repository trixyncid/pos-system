import { motion } from "motion/react"
import type { ReactNode } from "react"

/**
 * A ranked list with an inline bar per row, scaled to the top row: easier to
 * read on a tablet than a bar chart, and every value is printed.
 */
export function RankedList<T>({
  rows,
  value,
  label,
  detail,
  amount,
  empty,
}: {
  rows: T[]
  value: (row: T) => number
  label: (row: T) => string
  detail?: (row: T) => string
  amount: (row: T) => ReactNode
  empty: string
}) {
  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
    )
  const top = Math.max(...rows.map(value), 1)
  return (
    <ol className="space-y-3">
      {rows.map((row, index) => (
        <li key={label(row)} className="space-y-1.5">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="w-5 shrink-0 text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {label(row)}
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">
              {amount(row)}
            </span>
          </div>
          <div className="ml-7 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full origin-left rounded-full bg-chart-1"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: value(row) / top }}
                transition={{
                  type: "spring",
                  stiffness: 140,
                  damping: 24,
                  delay: index * 0.03,
                }}
              />
            </div>
            {detail && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {detail(row)}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
