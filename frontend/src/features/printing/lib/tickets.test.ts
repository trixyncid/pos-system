import { encode, row, wrap } from "@/features/printing/lib/ticket-doc.ts"
import {
  billTicket,
  kitchenTicket,
  shiftTicket,
} from "@/features/printing/lib/tickets.ts"
import type { TicketPayload } from "@/features/printing/schemas/print-job.ts"

const payload: TicketPayload = {
  kind: "kitchen",
  station: "kitchen",
  order_number: 12,
  label: "Meja 7",
  guests: 4,
  by: "Sari",
  at: "2026-10-30T19:42:00+07:00",
  lines: [
    {
      quantity: 2,
      name: "Nasi Goreng Spesial",
      modifiers: ["Extra pedas", "Telur ceplok"],
      note: "tanpa bawang",
      seat: 2,
    },
  ],
}

const texts = (doc: ReturnType<typeof kitchenTicket>) =>
  doc.flatMap((block) => (block.type === "text" ? [block.text] : []))

describe("kitchen ticket", () => {
  it("shows the table, each line, its choices, note and seat", () => {
    const lines = texts(kitchenTicket(payload, 48))
    expect(lines).toContain(" DAPUR ")
    expect(lines).toContain("MEJA 7")
    expect(lines).toContain("2x Nasi Goreng Spesial")
    expect(lines).toContain("   + Extra pedas")
    expect(lines).toContain("   ! tanpa bawang")
    expect(lines).toContain("   Kursi 2")
  })

  it("marks cancellations and reprints", () => {
    const lines = texts(
      kitchenTicket(
        {
          ...payload,
          kind: "void",
          reprint: true,
          lines: [{ ...payload.lines[0]!, void_reason: "salah input" }],
        },
        48
      )
    )
    expect(lines[0]).toBe(" BATAL · DAPUR ")
    expect(lines).toContain("** CETAK ULANG **")
    expect(lines).toContain("   Alasan: salah input")
  })

  it("encodes to ESC/POS: initialise first, paper cut last", () => {
    const bytes = encode(kitchenTicket(payload, 48), 48)
    expect([...bytes.slice(0, 2)]).toEqual([0x1b, 0x40]) // ESC @
    const tail = [...bytes.slice(-8)]
    const cut = tail.findIndex(
      (byte, i) => byte === 0x1d && tail[i + 1] === 0x56
    )
    expect(cut).toBeGreaterThanOrEqual(0) // GS V (cut) among the last bytes
  })
})

describe("layout helpers", () => {
  it("pads rows to the paper width", () => {
    expect(row("Subtotal", "Rp 72.000", 32)).toHaveLength(32)
    expect(
      row("Nasi goreng spesial dengan nama sangat panjang", "Rp 1", 32)
    ).toHaveLength(32)
  })

  it("wraps on spaces", () => {
    expect(wrap("Sate Ayam Madura sepuluh tusuk", 12)).toEqual([
      "Sate Ayam",
      "Madura",
      "sepuluh",
      "tusuk",
    ])
  })
})

const rows = (doc: ReturnType<typeof kitchenTicket>) =>
  Object.fromEntries(
    doc.flatMap((block) =>
      block.type === "row" ? [[block.left, block.right]] : []
    )
  )

describe("bill and receipt", () => {
  const bill: TicketPayload = {
    ...payload,
    kind: "receipt",
    station: "cashier",
    outlet: {
      name: "Warung Senja",
      address: "Jl. Kenanga 5",
      header: "",
      footer: "",
      npwpd: "P.123",
    },
    line_totals: [60_000],
    bill: {
      subtotal: 60_000,
      discount: 6_000,
      service: 2_700,
      tax: 5_670,
      rounding: 30,
      total: 62_400,
    },
    rates: { service: 5, pbjt: 10 },
    discount: { kind: "percent", value: 10, reason: "member" },
    payment: {
      method: "cash",
      amount: 62_400,
      tendered: 100_000,
      change: 37_600,
    },
    paid: 62_400,
  }

  it("prints the totals in bill order with the change", () => {
    const doc = billTicket(bill, 48)
    const totals = rows(doc)
    expect(totals["Diskon 10%"]).toBe("-Rp6.000")
    expect(totals["Servis 5%"]).toBe("Rp2.700")
    expect(totals["PBJT 10%"]).toBe("Rp5.670")
    expect(totals["Pembulatan"]).toBe("Rp30")
    expect(totals["TOTAL"]).toBe("Rp62.400")
    expect(totals["Kembali"]).toBe("Rp37.600")
    expect(texts(doc)).toContain("Terima kasih")
  })

  it("a bill says it is not a receipt", () => {
    const doc = billTicket({ ...bill, kind: "bill", payment: null }, 32)
    expect(texts(doc)).toContain("Bukan bukti pembayaran")
    expect(rows(doc)["Kembali"]).toBeUndefined()
  })
})

describe("shift report", () => {
  it("shows the expected cash and the variance", () => {
    const doc = shiftTicket(
      {
        ...payload,
        kind: "shift",
        station: "cashier",
        lines: [],
        shift: {
          opened_at: payload.at,
          closed_at: payload.at,
          opened_by: "Rina",
          opening_cash: 100_000,
          cash_sales: 50_000,
          other_sales: 0,
          cash_in: 0,
          cash_out: 20_000,
          expected_cash: 130_000,
          payments: 3,
          counted_cash: 129_000,
          variance: -1_000,
          unpaid_bills: 1,
          movements: [{ kind: "out", amount: 20_000, reason: "Es batu" }],
        },
      },
      48
    )
    const totals = rows(doc)
    expect(totals["Seharusnya di laci"]).toBe("Rp130.000")
    expect(totals["Selisih"]).toBe("-Rp1.000")
    expect(totals["Es batu"]).toBe("-Rp20.000")
  })
})
