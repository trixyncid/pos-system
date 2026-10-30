import { DeleteIcon } from "lucide-react"
import { useEffect, type ReactNode } from "react"

import { Pressable } from "@/components/motion/pressable.tsx"
import { cn } from "@/lib/utils.ts"

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const

function Key({
  children,
  label,
  onPress,
  disabled,
  tone = "default",
}: {
  children: ReactNode
  label?: string
  onPress: () => void
  disabled?: boolean
  tone?: "default" | "quiet"
}) {
  return (
    <Pressable
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      pressScale={0.92}
      className={cn(
        "grid h-16 place-items-center rounded-2xl font-heading text-2xl font-medium tabular-nums transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
        tone === "default"
          ? "bg-secondary shadow-(--shadow-soft) active:bg-accent"
          : "text-muted-foreground active:bg-muted"
      )}
    >
      {children}
    </Pressable>
  )
}

/**
 * The big 3×4 keypad for PINs, cash and quantities. `bottomLeft` holds a
 * context key (Clear, 000). With `keyboard`, a physical keyboard or a
 * Bluetooth keypad types into it too.
 */
export function NumPad({
  onDigit,
  onBackspace,
  bottomLeft,
  disabled,
  keyboard = false,
  deleteLabel,
  className,
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  bottomLeft?: { label: string; content: ReactNode; onPress: () => void }
  disabled?: boolean
  keyboard?: boolean
  deleteLabel: string
  className?: string
}) {
  useEffect(() => {
    if (!keyboard || disabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (/^\d$/.test(event.key)) onDigit(event.key)
      else if (event.key === "Backspace") onBackspace()
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [keyboard, disabled, onDigit, onBackspace])

  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      {digits.map((digit) => (
        <Key key={digit} disabled={disabled} onPress={() => onDigit(digit)}>
          {digit}
        </Key>
      ))}
      {bottomLeft ? (
        <Key
          label={bottomLeft.label}
          tone="quiet"
          disabled={disabled}
          onPress={bottomLeft.onPress}
        >
          <span className="text-base">{bottomLeft.content}</span>
        </Key>
      ) : (
        <span />
      )}
      <Key disabled={disabled} onPress={() => onDigit("0")}>
        0
      </Key>
      <Key
        label={deleteLabel}
        tone="quiet"
        disabled={disabled}
        onPress={onBackspace}
      >
        <DeleteIcon className="size-6" />
      </Key>
    </div>
  )
}
