import { encode, row, wrap } from "@/features/printing/lib/ticket-doc.ts"
import { kitchenTicket } from "@/features/printing/lib/tickets.ts"
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
