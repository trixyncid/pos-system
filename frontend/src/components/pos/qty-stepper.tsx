import { MinusIcon, PlusIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { Pressable } from "@/components/motion/pressable.tsx"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "default",
  labels,
  className,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: "default" | "sm"
  labels: { decrease: string; increase: string }
  className?: string
}) {
  const button = cn(
    "grid place-items-center rounded-xl bg-secondary text-secondary-foreground transition-colors active:bg-accent disabled:opacity-40",
    size === "sm" ? "size-10" : "size-12"
  )
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Pressable
        aria-label={labels.decrease}
        className={button}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <MinusIcon className="size-5" />
      </Pressable>
      <span
        className={cn(
          "relative grid place-items-center overflow-hidden font-heading font-semibold tabular-nums",
          size === "sm" ? "h-10 w-8 text-base" : "h-12 w-10 text-lg"
        )}
        aria-live="polite"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={spring.pop}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <Pressable
        aria-label={labels.increase}
        className={button}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <PlusIcon className="size-5" />
      </Pressable>
    </div>
  )
}
