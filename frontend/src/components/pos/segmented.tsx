import { motion } from "motion/react"
import { useId } from "react"

import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

/**
 * A row of mutually exclusive choices with a sliding highlight. Each option is
 * a 44px touch target; use it instead of a dropdown when there are 2–4 options.
 */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  label: string
  className?: string
}) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex rounded-xl bg-muted p-1 text-sm font-medium",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-11 flex-1 rounded-lg px-4 whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${id}`}
                transition={spring.layout}
                className="absolute inset-0 rounded-lg bg-background shadow-(--shadow-soft)"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
