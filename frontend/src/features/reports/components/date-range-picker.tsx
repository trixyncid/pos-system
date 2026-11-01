import { CalendarIcon, ChevronDownIcon } from "lucide-react"
import { enUS, id as idLocale, zhTW } from "react-day-picker/locale"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"
import { Calendar } from "@/components/ui/calendar.tsx"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx"
import type { Range } from "@/features/reports/api/reports.ts"
import { isoDate, parseIsoDate } from "@/lib/dates.ts"
import { localeTag } from "@/lib/i18n.ts"
import { cn } from "@/lib/utils.ts"

/** The API's limit (backend reports.services.MAX_DAYS). */
export const MAX_DAYS = 92

const startOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
const shift = (day: Date, days: number) => {
  const next = new Date(day)
  next.setDate(next.getDate() + days)
  return next
}

/** The shortcuts owners reach for, each a whole range ending today or a whole month. */
export function presets(): { key: string; from: Date; to: Date }[] {
  const today = startOfToday()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonthEnd = shift(monthStart, -1)
  return [
    { key: "today", from: today, to: today },
    { key: "yesterday", from: shift(today, -1), to: shift(today, -1) },
    { key: "last7", from: shift(today, -6), to: today },
    { key: "last30", from: shift(today, -29), to: today },
    { key: "thisMonth", from: monthStart, to: today },
    {
      key: "lastMonth",
      from: new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1),
      to: lastMonthEnd,
    },
  ]
}

/**
 * Pick the report's period: one tap on a shortcut, or two taps on the
 * calendar (start, then end). The report only changes once both ends are
 * set, so a half-picked range never loads.
 */
export function DateRangePicker({
  value,
  onChange,
}: {
  value: Range
  onChange: (range: Range) => void
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()
  const locale =
    i18n.language === "en"
      ? enUS
      : i18n.language === "zh-Hant"
        ? zhTW
        : idLocale
  const format = new Intl.DateTimeFormat(localeTag(i18n.language), {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const from = parseIsoDate(value.from)
  const to = parseIsoDate(value.to)
  const today = startOfToday()
  const active = presets().find(
    (preset) =>
      isoDate(preset.from) === value.from && isoDate(preset.to) === value.to
  )

  const apply = (range: { from: Date; to: Date }) => {
    onChange({ from: isoDate(range.from), to: isoDate(range.to) })
    setDraft(undefined)
    setOpen(false)
  }

  // While picking, the second tap may not go further than MAX_DAYS from the first.
  const picking = draft?.from && !draft.to ? draft.from : null

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setDraft(undefined)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="touch"
          className="min-w-0 justify-start gap-3 font-normal"
        >
          <CalendarIcon />
          <span className="truncate">
            {active && (
              <span className="font-medium">
                {t(`reports.presets.${active.key as "today"}`)} ·{" "}
              </span>
            )}
            <span className="tabular-nums">
              {value.from === value.to
                ? format.format(from)
                : `${format.format(from)} – ${format.format(to)}`}
            </span>
          </span>
          <ChevronDownIcon className="ml-auto text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex">
          <ul className="flex w-40 flex-col gap-1 border-r p-2">
            {presets().map((preset) => (
              <li key={preset.key}>
                <button
                  type="button"
                  onClick={() => apply(preset)}
                  className={cn(
                    "flex h-10 w-full items-center rounded-lg px-3 text-left text-sm transition-colors hover:bg-muted",
                    active?.key === preset.key &&
                      "bg-primary/10 font-medium text-accent-foreground"
                  )}
                >
                  {t(`reports.presets.${preset.key as "today"}`)}
                </button>
              </li>
            ))}
          </ul>
          <div className="p-2">
            <Calendar
              mode="range"
              locale={locale}
              // Two months side by side in landscape; one in portrait.
              numberOfMonths={window.innerWidth >= 960 ? 2 : 1}
              defaultMonth={shift(to, -28)}
              selected={draft ?? { from, to }}
              onSelect={(range, day) => {
                // A fresh pick always starts a new range at the tapped day.
                if (!draft) {
                  setDraft({ from: day, to: undefined })
                  return
                }
                setDraft(range)
                if (range?.from && range.to)
                  apply({ from: range.from, to: range.to })
              }}
              disabled={[
                { after: today },
                ...(picking
                  ? [
                      { before: shift(picking, -(MAX_DAYS - 1)) },
                      { after: shift(picking, MAX_DAYS - 1) },
                    ]
                  : []),
              ]}
              className="[--cell-size:--spacing(10)]"
            />
            <p className="px-2 pb-1 text-xs text-muted-foreground">
              {picking
                ? t("reports.pickEnd")
                : t("reports.pickStart", { days: MAX_DAYS })}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
