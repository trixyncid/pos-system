import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
} from "react"

import { Input } from "@/components/ui/input.tsx"
import { cn } from "@/lib/utils.ts"

const grouped = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 })
/** Ten billion rupiah: well above any payout, below the API limit. */
const MAX_DIGITS = 11

/**
 * The whole-rupiah digits in pasted text such as "Rp 750.000,50",
 * "750,000.50" or "750000". A separator followed by one or two digits at the
 * end is a decimal part and is dropped; every other separator groups
 * thousands. Without this, "750.000,50" would become 75.000.050.
 */
export function pastedRupiah(text: string) {
  const cleaned = text.replace(/[^\d.,]/g, "")
  const decimals = /[.,]\d{1,2}$/.exec(cleaned)
  return (decimals ? cleaned.slice(0, decimals.index) : cleaned).replace(
    /\D/g,
    ""
  )
}

/**
 * Whole-rupiah amount with thousands separators while typing ("750.000").
 * `value` is digits only ("750000"), or "" when empty.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  disabled,
  placeholder = "0",
  className,
  prefixClassName,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  /** Ids of the hint and error text, for aria-describedby. */
  describedBy?: string
  disabled?: boolean
  placeholder?: string
  /** Extra classes for the input, such as a larger size. */
  className?: string
  /** Extra classes for the "Rp" prefix, to match. */
  prefixClassName?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const caretDigits = useRef<number | null>(null)
  const shown = value ? grouped.format(Number(value)) : ""

  // Keep the caret after the same number of digits once separators move.
  useLayoutEffect(() => {
    const element = input.current
    const target = caretDigits.current
    if (!element || target === null || document.activeElement !== element)
      return
    caretDigits.current = null
    let position = 0
    let seen = 0
    while (position < element.value.length && seen < target) {
      if (/\d/.test(element.value.charAt(position))) seen += 1
      position += 1
    }
    element.setSelectionRange(position, position)
  })

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    const caret = event.target.selectionStart ?? raw.length
    const digits = raw
      .replace(/\D/g, "")
      .replace(/^0+(?=\d)/, "")
      .slice(0, MAX_DIGITS)
    caretDigits.current = raw.slice(0, caret).replace(/\D/g, "").length
    onChange(digits === "0" ? "" : digits)
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const pasted = pastedRupiah(event.clipboardData.getData("text"))
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? start
    const before = element.value.slice(0, start).replace(/\D/g, "")
    const after = element.value.slice(end).replace(/\D/g, "")
    const digits = `${before}${pasted}${after}`
      .replace(/^0+(?=\d)/, "")
      .slice(0, MAX_DIGITS)
    caretDigits.current = before.length + pasted.length
    onChange(digits === "0" ? "" : digits)
  }

  return (
    <div className="relative">
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground",
          prefixClassName
        )}
      >
        Rp
      </span>
      <Input
        ref={input}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        placeholder={placeholder}
        onChange={handleChange}
        onPaste={handlePaste}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn("pl-9 tabular-nums", className)}
      />
    </div>
  )
}
