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
import { areas } from "@/mocks/db/floor.ts"
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

export function recompute(order: Order) {
  order.subtotal = order.lines
    .filter((line) => line.status !== "void")
    .reduce((sum, line) => sum + line.total, 0)
  order.version += 1
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
  const order: Order = {
    id: mockId(),
    number: takeNumber(),
    channel: "restaurant",
    type: "dine_in",
    table: table.id,
    table_label: table.label,
    guests,
    status,
    waiter,
    note: "",
    subtotal: 0,
    version: 0,
    created_at: new Date(Date.now() - minutes * 60_000).toISOString(),
    lines,
  }
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
    label: order.table_label
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
