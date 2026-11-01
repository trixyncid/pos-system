import type { Shift } from "@/features/shifts/schemas/shift.ts"
import { mockId } from "@/mocks/db/catalog.ts"

/** Cash taken per shift (backend Payment.shift); totals are summed from it like Shift.totals(). */
export const shiftPayments: {
  shift: string
  method: string
  amount: number
}[] = []

export const shifts: Shift[] = []

/** Cash given back for refunded orders (backend payments.Refund). */
export const shiftRefunds: { shift: string; amount: number }[] = []

export function refreshTotals(shift: Shift) {
  const taken = shiftPayments.filter((p) => p.shift === shift.id)
  const sum = (items: { amount: number }[]) =>
    items.reduce((total, item) => total + item.amount, 0)
  const cashSales = sum(taken.filter((p) => p.method === "cash"))
  const cashIn = sum(shift.movements.filter((m) => m.kind === "in"))
  const cashOut = sum(shift.movements.filter((m) => m.kind === "out"))
  const refunds = sum(shiftRefunds.filter((r) => r.shift === shift.id))
  shift.totals = {
    cash_sales: cashSales,
    other_sales: sum(taken.filter((p) => p.method !== "cash")),
    cash_in: cashIn,
    cash_out: cashOut,
    refunds,
    expected_cash: shift.opening_cash + cashSales + cashIn - cashOut - refunds,
    payments: taken.length,
  }
  return shift
}

export const currentShift = () => shifts.find((shift) => !shift.closed_at)

/** A time of day, `daysAgo` days back, so every shift sits on its own calendar day. */
function dayAt(daysAgo: number, hour: number, minute = 0) {
  const at = new Date()
  at.setDate(at.getDate() - daysAgo)
  at.setHours(hour, minute, 0, 0)
  return at
}

// Today's shift opens at 06:30, before the 07:00 opening, or half an hour ago when it's earlier than that.
const openedToday = new Date(
  Math.max(
    dayAt(0, 0, 5).getTime(),
    Math.min(dayAt(0, 6, 30).getTime(), Date.now() - 30 * 60_000)
  )
)

/** How many days back the `nth` most recent trading day was (closed on Sundays). */
function tradingDaysAgo(nth: number) {
  let back = 0
  for (let found = 0; found < nth;) {
    back += 1
    if (dayAt(back, 12).getDay() !== 0) found += 1
  }
  return back
}

function seedClosed(
  daysAgo: number,
  by: string,
  opening: number,
  sales: number,
  counted: number
) {
  const shift: Shift = {
    id: mockId(),
    created_at: dayAt(daysAgo, 6, 30).toISOString(),
    opened_by_name: by,
    opening_cash: opening,
    closed_at: dayAt(daysAgo, 17, 30).toISOString(),
    closed_by_name: by,
    counted_cash: counted,
    expected_cash: opening + sales,
    variance: counted - (opening + sales),
    note: "",
    totals: {
      cash_sales: sales,
      other_sales: 0,
      cash_in: 0,
      cash_out: 0,
      refunds: 0,
      expected_cash: opening + sales,
      payments: Math.round(sales / 145_000),
    },
    movements: [],
  }
  shifts.push(shift)
}

seedClosed(tradingDaysAgo(2), "Budi Santoso", 500_000, 4_386_400, 4_886_400)
seedClosed(tradingDaysAgo(1), "Budi Santoso", 500_000, 5_120_700, 5_618_700)

// Today's shift is open, so checkout works straight away in the demo.
const today: Shift = {
  id: mockId(),
  created_at: openedToday.toISOString(),
  opened_by_name: "Budi Santoso",
  opening_cash: 500_000,
  closed_at: null,
  closed_by_name: null,
  counted_cash: null,
  expected_cash: null,
  variance: null,
  note: "",
  totals: {
    cash_sales: 0,
    other_sales: 0,
    cash_in: 0,
    cash_out: 0,
    refunds: 0,
    expected_cash: 0,
    payments: 0,
  },
  movements: [
    {
      id: mockId(),
      kind: "out",
      amount: 45_000,
      reason: "Beli es batu",
      by_name: "Dimas Pratama",
      created_at: new Date(
        (openedToday.getTime() + Date.now()) / 2
      ).toISOString(),
    },
  ],
}
shifts.push(today)
shiftPayments.push(
  { shift: today.id, method: "cash", amount: 186_400 },
  { shift: today.id, method: "cash", amount: 92_300 },
  { shift: today.id, method: "cash", amount: 254_100 }
)
refreshTotals(today)
