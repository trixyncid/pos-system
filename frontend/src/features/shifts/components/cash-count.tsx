import { useTranslation } from "react-i18next"

import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
import { MoneyInput } from "@/components/ui/money-input.tsx"
import { formatIDR } from "@/lib/money.ts"

/** Rupiah notes a drawer holds, largest first. */
export const NOTES = [
  100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000,
] as const

export type Count = { notes: Record<number, number>; coins: string }

export const emptyCount: Count = { notes: {}, coins: "" }

export const countTotal = (count: Count) =>
  NOTES.reduce((sum, note) => sum + note * (count.notes[note] ?? 0), 0) +
  Number(count.coins || 0)

/**
 * Counting the drawer note by note, the way cashiers actually do it, with
 * coins as one amount. Miscounting a pile is the usual cause of a variance.
 */
export function CashCount({
  value,
  onChange,
}: {
  value: Count
  onChange: (value: Count) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      {NOTES.map((note) => {
        const pieces = value.notes[note] ?? 0
        return (
          <div
            key={note}
            className="flex items-center gap-3 rounded-2xl border bg-background px-3 py-1.5"
          >
            <span className="w-24 font-heading font-semibold tabular-nums">
              {formatIDR(note)}
            </span>
            <QtyStepper
              size="sm"
              value={pieces}
              min={0}
              max={999}
              onChange={(next) =>
                onChange({ ...value, notes: { ...value.notes, [note]: next } })
              }
              labels={{ decrease: "−", increase: "+" }}
            />
            <span className="text-xs text-muted-foreground">
              {t("shifts.pieces")}
            </span>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {pieces ? formatIDR(pieces * note) : "—"}
            </span>
          </div>
        )
      })}
      <div className="flex items-center gap-3 rounded-2xl border bg-background px-3 py-1.5">
        <span className="w-24 font-medium">{t("shifts.coins")}</span>
        <div className="flex-1">
          <MoneyInput
            value={value.coins}
            onChange={(coins) => onChange({ ...value, coins })}
            className="h-10 rounded-xl"
          />
        </div>
      </div>
    </div>
  )
}
