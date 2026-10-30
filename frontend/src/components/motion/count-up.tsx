import { motion, useReducedMotion, useSpring, useTransform } from "motion/react"
import { useEffect } from "react"

/**
 * A number that rolls to its new value, for totals and KPIs. The text is
 * always the formatted final value for screen readers; only the visible
 * digits animate.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()
  const spring = useSpring(value, { stiffness: 260, damping: 32 })
  const text = useTransform(spring, (n) => format(n))

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  if (reduce) return <span className={className}>{format(value)}</span>

  return (
    <span className={className}>
      <span className="sr-only">{format(value)}</span>
      <motion.span aria-hidden>{text}</motion.span>
    </span>
  )
}
