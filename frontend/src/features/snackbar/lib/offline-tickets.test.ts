import {
  OFFLINE_LABEL,
  offlineTickets,
} from "@/features/snackbar/lib/offline-tickets.ts"
import type { CounterLine } from "@/features/snackbar/store/cart.ts"

const line = (id: string, name: string, price: number, quantity = 1) =>
  ({
    id,
    product: id,
    name,
    image: null,
    unit_price: price,
    quantity,
    tax_category: "none",
  }) satisfies CounterLine

const bill = {
  subtotal: 46_000,
  discount: 0,
  service: 0,
  tax: 2_200,
  rounding: 0,
  total: 48_200,
}

describe("offline tickets", () => {
  it("prints a receipt with the payment and a ticket per station", () => {
    const [receipt, ...tickets] = offlineTickets({
      lines: [
        line("chips", "Keripik", 12_000, 2),
        line("coffee", "Es Kopi", 22_000),
      ],
      stationOf: (l) => (l.id === "coffee" ? "bar" : "none"),
      bill,
      outlet: undefined,
      payment: {
        method: "cash",
        amount: 48_200,
        tendered: 50_000,
        change: 1_800,
      },
      by: "Budi",
      at: "2026-11-07T10:00:00+08:00",
    })
    expect(receipt).toMatchObject({
      kind: "receipt",
      station: "cashier",
      label: OFFLINE_LABEL,
      line_totals: [24_000, 22_000],
      bill,
      payment: { change: 1_800 },
      paid: 48_200,
    })
    expect(receipt?.order_number).toBeUndefined()
    expect(tickets).toEqual([
      expect.objectContaining({
        kind: "kitchen",
        station: "bar",
        lines: [expect.objectContaining({ name: "Es Kopi", quantity: 1 })],
      }),
    ])
  })
})
