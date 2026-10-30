import type { FloorTable } from "@/features/floor/schemas/floor.ts"
import type { Order, OrderLine } from "@/features/ordering/schemas/order.ts"
import type {
  PrintJob,
  TicketPayload,
} from "@/features/printing/schemas/print-job.ts"
import {
  categories,
  mockId,
  modifierGroups,
  products,
} from "@/mocks/db/catalog.ts"
import { billTotals, percentOf, shareOf, type BillRules } from "@/lib/money.ts"
import { areas } from "@/mocks/db/floor.ts"
import { outlet } from "@/mocks/db/outlet.ts"
import { staff } from "@/mocks/db/staff.ts"

export const orders: Order[] = []
export const printJobs: PrintJob[] = []

let nextNumber = 1
export function takeNumber() {
  return nextNumber++
}

export function findTable(id: string | null) {
  return areas.flatMap((area) => area.tables).find((table) => table.id === id)
}

export function stationOf(productId: string) {
  const product = products.find((p) => p.id === productId)
  return categories.find((c) => c.id === product?.category)?.station ?? "none"
}

export function billRules(): BillRules {
  return {
    servicePercent: outlet.service_percent,
    pbjtPercent: outlet.pbjt_percent,
    taxBase: outlet.tax_base,
    rounding: outlet.cash_rounding,
  }
}

/** backend payments/billing.order_discount */
export function discountOf(order: Order, subtotal: number) {
  if (order.discount_kind === "percent")
    return Math.min(subtotal, percentOf(subtotal, order.discount_value))
  if (order.discount_kind === "amount")
    return Math.min(subtotal, order.discount_value)
  return 0
}

/** backend payments/billing.lines_bill: the order's discount is spread in proportion. */
/** backend payments/billing._bill_for: no service at the counter, PBJT only on PBJT lines. */
function billFor(order: Order, lines: OrderLine[], discount: number) {
  const sum = (items: OrderLine[]) =>
    items.reduce((total, line) => total + line.total, 0)
  return billTotals(sum(lines), discount, billRules(), {
    service: order.channel !== "snackbar",
    taxable: sum(lines.filter((line) => line.tax_category === "pbjt")),
  })
}

export function linesBill(order: Order, lines: OrderLine[]) {
  const part = lines.reduce((sum, line) => sum + line.total, 0)
  return billFor(
    order,
    lines,
    shareOf(discountOf(order, order.subtotal), part, order.subtotal)
  )
}

export function recompute(order: Order) {
  order.subtotal = order.lines
    .filter((line) => line.status !== "void")
    .reduce((sum, line) => sum + line.total, 0)
  order.bill = billFor(
    order,
    order.lines.filter((line) => line.status !== "void"),
    discountOf(order, order.subtotal)
  )
  order.paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
  order.remaining = Math.max(0, order.bill.total - order.paid)
  order.version += 1
}

/** A fresh order, as the API opens one. */
export function blankOrder(
  fields: Pick<
    Order,
    "id" | "table" | "table_label" | "guests" | "waiter" | "created_at"
  > &
    Partial<Order>
): Order {
  return {
    number: takeNumber(),
    channel: "restaurant",
    type: "dine_in",
    status: "open",
    note: "",
    subtotal: 0,
    discount_kind: "none",
    discount_value: 0,
    discount_reason: "",
    bill: billTotals(0, 0, billRules()),
    paid: 0,
    remaining: 0,
    payments: [],
    billed_at: null,
    version: 0,
    lines: [],
    ...fields,
  }
}

export function makeLine(
  productName: string,
  quantity: number,
  options: {
    modifiers?: string[]
    note?: string
    status?: OrderLine["status"]
    by?: string
    minutesAgo?: number
  } = {}
): OrderLine {
  const product = products.find((p) => p.name === productName)
  if (!product) throw new Error(`No mock product ${productName}`)
  const modifiers = (options.modifiers ?? []).map((name) => {
    const group = modifierGroups.find((g) =>
      g.options.some((o) => o.name === name)
    )
    const option = group?.options.find((o) => o.name === name)
    if (!group || !option) throw new Error(`No mock modifier ${name}`)
    return {
      group: group.name,
      name: option.name,
      price_delta: option.price_delta,
    }
  })
  const unit =
    product.price + modifiers.reduce((sum, m) => sum + m.price_delta, 0)
  const status = options.status ?? "sent"
  return {
    id: mockId(),
    product: product.id,
    name: product.name,
    unit_price: unit,
    quantity,
    modifiers,
    note: options.note ?? "",
    seat: null,
    station: stationOf(product.id),
    status,
    total: unit * quantity,
    added_by_name: options.by ?? "Sari",
    sent_at:
      status === "sent"
        ? new Date(
            Date.now() - (options.minutesAgo ?? 0) * 60_000
          ).toISOString()
        : null,
    void_reason: "",
    tax_category: product.tax_category,
    paid: false,
  }
}

function seed(
  label: string,
  minutes: number,
  guests: number,
  waiter: string,
  lines: OrderLine[],
  status: Order["status"] = "open"
) {
  const table = areas
    .flatMap((area) => area.tables)
    .find((t) => t.label === label)!
  const order = blankOrder({
    id: mockId(),
    table: table.id,
    table_label: table.label,
    guests,
    status,
    waiter,
    created_at: new Date(Date.now() - minutes * 60_000).toISOString(),
    billed_at:
      status === "billed"
        ? new Date(Date.now() - 3 * 60_000).toISOString()
        : null,
    lines,
  })
  recompute(order)
  orders.push(order)
}

seed("2", 34, 2, "Sari Lestari", [
  makeLine("Nasi Goreng Spesial", 1, {
    modifiers: ["Pedas", "Telur ceplok"],
    minutesAgo: 30,
  }),
  makeLine("Es Teh Manis", 2, { modifiers: ["Kurang manis"], minutesAgo: 30 }),
])
seed("5", 61, 4, "Agus Setiawan", [
  makeLine("Ayam Geprek", 2, {
    modifiers: ["Extra pedas"],
    minutesAgo: 55,
    by: "Agus",
  }),
  makeLine("Sate Ayam (10 tusuk)", 1, {
    modifiers: ["Sedang"],
    minutesAgo: 55,
    by: "Agus",
  }),
  makeLine("Es Kopi Susu", 3, { minutesAgo: 55, by: "Agus" }),
  makeLine("Pisang Goreng", 1, { status: "held", by: "Agus" }),
])
seed("6", 4, 3, "Sari Lestari", [])
seed(
  "8",
  78,
  7,
  "Agus Setiawan",
  [
    makeLine("Rendang Sapi", 3, { minutesAgo: 70, by: "Agus" }),
    makeLine("Ikan Bakar Jimbaran", 2, {
      modifiers: ["Sedang"],
      minutesAgo: 70,
      by: "Agus",
    }),
    makeLine("Gado-gado", 2, {
      modifiers: ["Tidak pedas"],
      minutesAgo: 70,
      by: "Agus",
    }),
    makeLine("Es Jeruk", 7, { minutesAgo: 70, by: "Agus" }),
  ],
  "billed"
)
seed("12", 18, 4, "Sari Lestari", [
  makeLine("Mie Goreng Jawa", 2, { modifiers: ["Sedang"], minutesAgo: 15 }),
  makeLine("Bakso Urat", 2, { minutesAgo: 15 }),
  makeLine("Es Teh Manis", 4, { minutesAgo: 15 }),
])
seed("15", 9, 2, "Agus Setiawan", [
  makeLine("Lemon Tea", 2, { status: "held", by: "Agus" }),
])

/** The live state the floor shows for a table, as the backend's floor_occupancy computes it. */
export function withOccupancy(table: FloorTable): FloorTable {
  const order = orders.find(
    (o) =>
      o.table === table.id && (o.status === "open" || o.status === "billed")
  )
  if (!order)
    return {
      ...table,
      seated_at: null,
      guests: null,
      order_total: null,
      waiter: null,
      order_id: null,
    }
  const status =
    order.status === "billed"
      ? "billed"
      : order.lines.some((line) => line.status === "sent")
        ? "ordered"
        : "occupied"
  return {
    ...table,
    status,
    seated_at: order.created_at,
    guests: order.guests,
    order_total: order.subtotal,
    waiter: order.waiter,
    order_id: order.id,
  }
}

export function ticketPayload(
  order: Order,
  lines: OrderLine[],
  station: string,
  kind: TicketPayload["kind"],
  by: string
): TicketPayload {
  return {
    kind,
    station,
    order_id: order.id,
    order_number: order.number,
    label:
      order.channel === "snackbar"
        ? `Snack bar #${order.number}`
        : order.table_label
          ? `Meja ${order.table_label}`
          : `Bawa pulang #${order.number}`,
    type: order.type,
    guests: order.guests,
    by,
    at: new Date().toISOString(),
    lines: lines.map((line) => ({
      quantity: line.quantity,
      name: line.name,
      modifiers: line.modifiers.map((m) => m.name),
      note: line.note,
      seat: line.seat,
      void_reason: line.void_reason || null,
    })),
  }
}

export function staffName(id: number) {
  return staff.find((member) => member.id === id)?.full_name ?? "?"
}

/** backend printing/tickets.bill_payload */
export function billPayload(
  order: Order,
  kind: "bill" | "receipt",
  by: string,
  payment: Order["payments"][number] | null = null
): TicketPayload {
  const lines = order.lines.filter((line) => line.status !== "void")
  return {
    ...ticketPayload(order, lines, "cashier", kind, by),
    outlet: {
      name: outlet.name,
      address: outlet.address,
      header: outlet.receipt_header,
      footer: outlet.receipt_footer,
      npwpd: outlet.npwpd,
    },
    line_totals: lines.map((line) => line.total),
    bill: order.bill,
    rates: { service: outlet.service_percent, pbjt: outlet.pbjt_percent },
    discount:
      order.discount_kind === "none"
        ? null
        : {
            kind: order.discount_kind,
            value: order.discount_value,
            reason: order.discount_reason,
          },
    payment: payment && {
      method: payment.method,
      amount: payment.amount,
      tendered: payment.tendered,
      change: payment.change,
    },
    paid: order.paid,
  }
}

export function pushJob(payload: TicketPayload) {
  const job: PrintJob = {
    id: mockId(),
    station: payload.station,
    kind: payload.kind,
    status: "queued",
    payload,
    attempts: 0,
    error: "",
    created_at: new Date().toISOString(),
    printed_at: null,
  }
  printJobs.push(job)
  return job
}
