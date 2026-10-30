import { motion } from "motion/react"

import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

/** Filled dots for typed PIN digits. `error` shakes the row; a new attempt (`attempt`) restarts it. */
export function PinDots({
  length,
  filled,
  error,
  attempt,
}: {
  length: number
  filled: number
  error: boolean
  attempt: number
}) {
  return (
    <div
      key={attempt}
      role="status"
      aria-label={`${filled} / ${length}`}
      className={cn("flex justify-center gap-4", error && "animate-shake")}
    >
      {Array.from({ length }, (_, index) => {
        const on = index < filled
        return (
          <motion.span
            key={index}
            animate={{ scale: on ? 1 : 0.7 }}
            transition={spring.pop}
            className={cn(
              "size-4 rounded-full border-2 transition-colors duration-150",
              on
                ? error
                  ? "border-danger bg-danger"
                  : "border-primary bg-primary"
                : "border-border bg-transparent"
            )}
          />
        )
      })}
    </div>
  )
}
