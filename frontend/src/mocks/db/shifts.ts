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

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString()

function seedClosed(
  daysAgo: number,
  by: string,
  opening: number,
  sales: number,
  counted: number
) {
  const opened = hoursAgo(daysAgo * 24 + 10)
  const shift: Shift = {
    id: mockId(),
    created_at: opened,
    opened_by_name: by,
    opening_cash: opening,
    closed_at: hoursAgo(daysAgo * 24 + 1),
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

seedClosed(2, "Budi Santoso", 500_000, 4_386_400, 4_886_400)
seedClosed(1, "Budi Santoso", 500_000, 5_120_700, 5_618_700)

// Today's shift is open, so checkout works straight away in the demo.
const today: Shift = {
  id: mockId(),
  created_at: hoursAgo(5),
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
      created_at: hoursAgo(3),
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
