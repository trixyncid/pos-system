import { numberFormat } from "@/lib/locale-format.ts"

const compact = numberFormat({
  notation: "compact",
  maximumFractionDigits: 1,
})

/** Short rupiah for chart axes: "1,2 jt", "850 rb" (or "120萬" in Chinese). */
export function compactIDR(amount: number) {
  return compact.format(amount)
}

/** The change from `before` to `now` in percent, or null when there was nothing before. */
export function change(now: number, before: number) {
  if (!before) return null
  return Math.round(((now - before) / before) * 1_000) / 10
}
