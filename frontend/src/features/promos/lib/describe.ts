import type { TFunction } from "i18next"

import type { Promo } from "@/features/promos/schemas/promo.ts"
import { localeTag } from "@/lib/i18n.ts"
import { formatIDR } from "@/lib/money.ts"

/** "10% off the bill", "Rp 5.000 off items", "Buy 2, get 1 free". */
export function describeBenefit(promo: Promo, t: TFunction) {
  if (promo.kind === "bundle")
    return promo.value >= 100
      ? t("promos.summary.bundleFree", {
          buy: promo.buy_quantity ?? 1,
          get: promo.get_quantity ?? 1,
        })
      : t("promos.summary.bundlePercent", {
          buy: promo.buy_quantity ?? 1,
          get: promo.get_quantity ?? 1,
          value: promo.value,
        })
  const amount =
    promo.benefit === "percent" ? `${promo.value}%` : formatIDR(promo.value)
  if (promo.benefit === "price") return t("promos.summary.price", { amount })
  return t(
    promo.kind === "bill" ? "promos.summary.bill" : "promos.summary.items",
    {
      amount,
    }
  )
}

/** Minimum spend and cap, when set. */
export function describeLimits(promo: Promo, t: TFunction) {
  return [
    promo.min_spend > 0 &&
      t("promos.summary.minSpend", { amount: formatIDR(promo.min_spend) }),
    promo.max_discount !== null &&
      t("promos.summary.cap", { amount: formatIDR(promo.max_discount) }),
  ].filter(Boolean) as string[]
}

/** Monday-first short day names in the current language. */
export function dayNames(language: string) {
  const format = new Intl.DateTimeFormat(localeTag(language), {
    weekday: "short",
  })
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, day) =>
    format.format(new Date(2024, 0, 1 + day))
  )
}

/** "Mon–Thu", "Sat, Sun", or null for every day. Runs of 3+ days collapse to a range. */
export function describeDays(weekdays: number[], language: string) {
  if (weekdays.length === 0 || weekdays.length === 7) return null
  const names = dayNames(language)
  const sorted = [...weekdays].sort((a, b) => a - b)
  const runs: number[][] = []
  for (const day of sorted) {
    const last = runs.at(-1)
    if (last && day === last.at(-1)! + 1) last.push(day)
    else runs.push([day])
  }
  return runs
    .map((run) =>
      run.length >= 3
        ? `${names[run[0]!]}–${names[run.at(-1)!]}`
        : run.map((day) => names[day]).join(", ")
    )
    .join(", ")
}

/** "14.00–17.00" from "14:00:00". */
export function describeHours(promo: Promo) {
  if (!promo.starts_at || !promo.ends_at) return null
  const short = (time: string) => time.slice(0, 5).replace(":", ".")
  return `${short(promo.starts_at)}–${short(promo.ends_at)}`
}

export type PromoState = "on" | "later" | "ended" | "off"

/** Whether a promo can be used today at all (its hours aside). */
export function promoState(promo: Promo, today: string): PromoState {
  if (!promo.is_active) return "off"
  if (promo.ends_on && today > promo.ends_on) return "ended"
  if (promo.starts_on && today < promo.starts_on) return "later"
  return "on"
}
