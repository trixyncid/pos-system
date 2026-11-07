import type { Outlet } from "@/features/outlet/schemas/outlet.ts"
import type {
  Bill,
  TicketPayload,
} from "@/features/printing/schemas/print-job.ts"
import type { CounterLine } from "@/features/snackbar/store/cart.ts"

/** Printed where the sale number goes: the server numbers the sale when it syncs. */
export const OFFLINE_LABEL = "Snack bar · OFFLINE"

type Sale = {
  lines: CounterLine[]
  /** Each line's kitchen or bar station ("none" prints nowhere but the receipt). */
  stationOf: (line: CounterLine) => string
  bill: Bill
  outlet: Outlet | undefined
  payment: { method: string; amount: number; tendered: number; change: number }
  by: string
  at: string
}

/**
 * The receipt and any kitchen or bar tickets for a counter sale made
 * offline, laid out as the server would (backend printing/tickets.py), so
 * the PC prints them through the same templates.
 */
export function offlineTickets(sale: Sale): TicketPayload[] {
  const ticketLine = (line: CounterLine) => ({
    quantity: line.quantity,
    name: line.name,
    modifiers: [],
    note: "",
    seat: null,
  })
  const base = {
    label: OFFLINE_LABEL,
    type: "takeaway",
    guests: 1,
    by: sale.by,
    at: sale.at,
  }
  const receipt: TicketPayload = {
    ...base,
    kind: "receipt",
    station: "cashier",
    lines: sale.lines.map(ticketLine),
    outlet: sale.outlet && {
      name: sale.outlet.name,
      address: sale.outlet.address,
      header: sale.outlet.receipt_header,
      footer: sale.outlet.receipt_footer,
      npwpd: sale.outlet.npwpd,
    },
    line_totals: sale.lines.map((line) => line.unit_price * line.quantity),
    bill: sale.bill,
    rates: {
      service: sale.outlet?.service_percent ?? 0,
      pbjt: sale.outlet?.pbjt_percent ?? 0,
    },
    discount: null,
    payment: sale.payment,
    paid: sale.payment.amount,
  }
  const byStation = new Map<string, CounterLine[]>()
  for (const line of sale.lines) {
    const station = sale.stationOf(line)
    if (station !== "none")
      byStation.set(station, [...(byStation.get(station) ?? []), line])
  }
  const tickets: TicketPayload[] = [...byStation].map(([station, lines]) => ({
    ...base,
    kind: "kitchen",
    station,
    lines: lines.map(ticketLine),
  }))
  return [receipt, ...tickets]
}
