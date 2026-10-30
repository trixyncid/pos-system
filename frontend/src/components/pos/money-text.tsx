import { CountUp } from "@/components/motion/count-up.tsx"
import { formatIDR } from "@/lib/money.ts"
import { cn } from "@/lib/utils.ts"

/** Rupiah with tabular digits, so columns of prices line up. `animate` rolls the value on change. */
export function MoneyText({
  amount,
  animate = false,
  className,
}: {
  amount: number
  animate?: boolean
  className?: string
}) {
  const classes = cn("tabular-nums", className)
  if (animate)
    return <CountUp value={amount} format={formatIDR} className={classes} />
  return <span className={classes}>{formatIDR(amount)}</span>
}
