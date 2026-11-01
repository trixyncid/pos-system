import i18n, { localeTag } from "@/lib/i18n.ts"

/**
 * Intl formatters that follow the UI language (dates and short numbers in
 * Chinese read "11月1日", "200萬"). Each is built once per language. Money
 * keeps formatIDR, and printed tickets stay Indonesian.
 */
function perLanguage<T>(make: (tag: string) => T) {
  const made = new Map<string, T>()
  return () => {
    const tag = localeTag(i18n.language)
    let formatter = made.get(tag)
    if (!formatter) {
      formatter = make(tag)
      made.set(tag, formatter)
    }
    return formatter
  }
}

export function dateFormat(options: Intl.DateTimeFormatOptions) {
  const current = perLanguage((tag) => new Intl.DateTimeFormat(tag, options))
  return { format: (value: Date | number) => current().format(value) }
}

export function numberFormat(options: Intl.NumberFormatOptions) {
  const current = perLanguage((tag) => new Intl.NumberFormat(tag, options))
  return { format: (value: number) => current().format(value) }
}
