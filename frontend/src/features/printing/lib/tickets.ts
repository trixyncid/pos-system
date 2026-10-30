import type {
  Block,
  Columns,
  TicketDoc,
} from "@/features/printing/lib/ticket-doc.ts"
import { wrap } from "@/features/printing/lib/ticket-doc.ts"
import type { TicketPayload } from "@/features/printing/schemas/print-job.ts"

const stationNames: Record<string, string> = {
  kitchen: "DAPUR",
  bar: "BAR",
  cashier: "KASIR",
}

const time = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * The kitchen and bar ticket: big table name, then each line with its
 * choices, note and seat, so the cook never has to ask. A cancellation
 * ticket prints the same lines under an inverted BATAL banner.
 */
export function kitchenTicket(
  payload: TicketPayload,
  columns: Columns
): TicketDoc {
  const doc: Block[] = []
  const station = stationNames[payload.station] ?? payload.station.toUpperCase()
  const cancel = payload.kind === "void"

  doc.push({
    type: "text",
    text: cancel ? ` BATAL · ${station} ` : ` ${station} `,
    align: "center",
    bold: true,
    invert: true,
  })
  if (payload.reprint)
    doc.push({
      type: "text",
      text: "** CETAK ULANG **",
      align: "center",
      bold: true,
    })
  doc.push({ type: "feed", lines: 1 })
  doc.push({
    type: "text",
    text: (payload.label ?? "").toUpperCase(),
    align: "center",
    bold: true,
    size: 2,
  })
  const meta = [
    payload.order_number ? `#${payload.order_number}` : null,
    payload.by,
    time.format(new Date(payload.at)),
    payload.guests ? `${payload.guests} tamu` : null,
  ].filter(Boolean)
  doc.push({ type: "text", text: meta.join(" · "), align: "center" })
  doc.push({ type: "rule" })

  payload.lines.forEach((line, index) => {
    if (index > 0) doc.push({ type: "feed", lines: 1 })
    // Double height reads from across a kitchen; width stays normal so names fit.
    wrap(`${line.quantity}x ${line.name}`, columns).forEach((text, i) =>
      doc.push({
        type: "text",
        text: i === 0 ? text : `   ${text}`,
        bold: true,
        size: "tall",
      })
    )
    for (const modifier of line.modifiers)
      doc.push({ type: "text", text: `   + ${modifier}` })
    if (line.note)
      wrap(line.note, columns - 5).forEach((text) =>
        doc.push({ type: "text", text: `   ! ${text}`, bold: true })
      )
    if (line.seat) doc.push({ type: "text", text: `   Kursi ${line.seat}` })
    if (cancel && line.void_reason)
      doc.push({ type: "text", text: `   Alasan: ${line.void_reason}` })
  })
  doc.push({ type: "rule" })
  return doc
}

export function testTicket(
  payload: TicketPayload,
  columns: Columns
): TicketDoc {
  return [
    {
      type: "text",
      text: " TES PRINTER ",
      align: "center",
      bold: true,
      invert: true,
    },
    { type: "feed", lines: 1 },
    {
      type: "text",
      text: stationNames[payload.station] ?? payload.station,
      align: "center",
      bold: true,
      size: 2,
    },
    {
      type: "text",
      text: `${columns} kolom · ${time.format(new Date(payload.at))}`,
      align: "center",
    },
    { type: "rule" },
    { type: "text", text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789" },
    { type: "text", text: "Rp 1.234.567 · Pembulatan · Kembali" },
    { type: "text", text: "Tebal", bold: true },
    { type: "text", text: "Besar", size: 2 },
    { type: "rule" },
    { type: "text", text: `Oleh ${payload.by}`, align: "center" },
  ]
}

/** The layout for any job the station receives. Bills and receipts arrive with checkout (M6). */
export function ticketFor(payload: TicketPayload, columns: Columns): TicketDoc {
  if (payload.kind === "test") return testTicket(payload, columns)
  return kitchenTicket(payload, columns)
}
