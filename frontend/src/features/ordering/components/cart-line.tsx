import { PauseIcon, Trash2Icon, UserIcon } from "lucide-react"
import { animate, motion, useMotionValue, useTransform } from "motion/react"
import { useTranslation } from "react-i18next"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

const REVEAL = -96
const TRIGGER = -72

/**
 * One line in the cart. Swipe left to remove a new line or void a sent one;
 * the red action behind it grows as the finger moves, so the gesture is
 * discoverable and never fires by accident.
 */
export function CartLine({
  quantity,
  name,
  modifiers,
  note,
  seat,
  total,
  tone = "new",
  held = false,
  onSwipe,
  swipeLabel,
  onTap,
  trailing,
}: {
  quantity: number
  name: string
  modifiers: string[]
  note: string
  seat: number | null
  total: number
  tone?: "new" | "sent" | "void"
  held?: boolean
  onSwipe?: () => void
  swipeLabel?: string
  onTap?: () => void
  trailing?: React.ReactNode
}) {
  const { t } = useTranslation()
  const x = useMotionValue(0)
  const actionOpacity = useTransform(x, [0, TRIGGER], [0, 1])
  const swipeable = Boolean(onSwipe) && tone !== "void"

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      transition={spring.layout}
      className="relative overflow-hidden rounded-2xl"
    >
      {swipeable && (
        <motion.div
          aria-hidden
          style={{ opacity: actionOpacity }}
          className="absolute inset-0 flex items-center justify-end rounded-2xl bg-danger pr-5 text-sm font-semibold text-white"
        >
          <Trash2Icon className="mr-1.5 size-4" />
          {swipeLabel}
        </motion.div>
      )}
      <motion.div
        drag={swipeable ? "x" : false}
        dragConstraints={{ left: REVEAL, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < TRIGGER) onSwipe?.()
          void animate(x, 0, spring.press)
        }}
        onTap={onTap}
        className={cn(
          "relative flex gap-3 rounded-2xl px-3 py-3 transition-colors",
          tone === "new" && "bg-card",
          tone === "sent" && "bg-card/60",
          tone === "void" && "bg-transparent opacity-50",
          held && "border-2 border-dashed border-warning/60",
          onTap && "cursor-pointer active:bg-muted/60"
        )}
      >
        <span
          className={cn(
            "grid h-8 min-w-8 place-items-center rounded-lg font-heading text-sm font-semibold tabular-nums",
            tone === "new"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {quantity}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block leading-tight font-medium",
              tone === "void" && "line-through"
            )}
          >
            {name}
          </span>
          {modifiers.length > 0 && (
            <span className="block text-sm text-muted-foreground">
              {modifiers.join(" · ")}
            </span>
          )}
          {note && (
            <span className="block text-sm text-warning-ink">“{note}”</span>
          )}
          <span className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
            {seat !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                <UserIcon className="size-3" />
                {t("order.seat")} {seat}
              </span>
            )}
            {held && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning-ink">
                <PauseIcon className="size-3" />
                {t("order.held")}
              </span>
            )}
            {trailing}
          </span>
        </span>
        <MoneyText
          amount={total}
          className={cn(
            "shrink-0 text-sm font-medium",
            tone === "void" && "line-through"
          )}
        />
      </motion.div>
    </motion.li>
  )
}
