import type {
  Block,
  Columns,
  TicketDoc,
} from "@/features/printing/lib/ticket-doc.ts"
import { wrap } from "@/features/printing/lib/ticket-doc.ts"
import { formatIDR } from "@/lib/money.ts"
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

const dateTime = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

/** "Rp 25.000" without the space, so money columns stay narrow on 58 mm paper. */
const money = (amount: number) => formatIDR(amount).replace("Rp ", "Rp")

const percent = (value: number) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)}%`

function outletHeader(payload: TicketPayload, columns: Columns): Block[] {
  const outlet = payload.outlet
  if (!outlet) return []
  const doc: Block[] = [
    {
      type: "text",
      text: outlet.name,
      align: "center",
      bold: true,
      size: 2,
    },
  ]
  for (const part of [outlet.address, outlet.header])
    for (const line of part.split("\n").filter(Boolean))
      wrap(line, columns).forEach((text) =>
        doc.push({ type: "text", text, align: "center" })
      )
  if (outlet.npwpd)
    doc.push({ type: "text", text: `NPWPD ${outlet.npwpd}`, align: "center" })
  return doc
}

/**
 * The bill (before paying) and the receipt (after): every line with its
 * price, then subtotal → discount → service → PBJT → rounding → total, the
 * same order as the tablet. A receipt adds what was paid and the change.
 */
export function billTicket(
  payload: TicketPayload,
  columns: Columns
): TicketDoc {
  const doc: Block[] = outletHeader(payload, columns)
  const receipt = payload.kind === "receipt"
  doc.push({ type: "rule" })
  doc.push({
    type: "text",
    text: payload.refund
      ? "STRUK REFUND"
      : receipt
        ? "STRUK PEMBAYARAN"
        : "TAGIHAN",
    align: "center",
    bold: true,
  })
  if (payload.reprint)
    doc.push({ type: "text", text: "** CETAK ULANG **", align: "center" })
  doc.push({
    type: "row",
    left: payload.label ?? "",
    right: payload.order_number ? `#${payload.order_number}` : "",
  })
  doc.push({
    type: "row",
    left: dateTime.format(new Date(payload.at)),
    right: payload.by,
  })
  doc.push({ type: "rule" })

  payload.lines.forEach((line, index) => {
    const total = payload.line_totals?.[index] ?? 0
    const name = `${line.quantity}x ${line.name}`
    const width = columns - money(total).length - 1
    const [first = "", ...rest] = wrap(name, width)
    doc.push({ type: "row", left: first, right: money(total) })
    for (const text of rest) doc.push({ type: "text", text: `   ${text}` })
    for (const modifier of line.modifiers)
      doc.push({ type: "text", text: `   + ${modifier}` })
  })
  doc.push({ type: "rule" })

  const bill = payload.bill
  if (bill) {
    doc.push({ type: "row", left: "Subtotal", right: money(bill.subtotal) })
    if (bill.discount) {
      const discount = payload.discount
      const label =
        discount?.kind === "promo"
          ? `Promo ${discount.reason}`
          : discount?.kind === "percent"
            ? `Diskon ${percent(discount.value)}`
            : "Diskon"
      doc.push({ type: "row", left: label, right: `-${money(bill.discount)}` })
    }
    if (bill.service)
      doc.push({
        type: "row",
        left: `Servis ${percent(payload.rates?.service ?? 0)}`,
        right: money(bill.service),
      })
    if (bill.tax)
      doc.push({
        type: "row",
        left: `PBJT ${percent(payload.rates?.pbjt ?? 0)}`,
        right: money(bill.tax),
      })
    if (bill.rounding)
      doc.push({
        type: "row",
        left: "Pembulatan",
        right: `${bill.rounding < 0 ? "-" : ""}${money(Math.abs(bill.rounding))}`,
      })
    doc.push({ type: "rule" })
    doc.push({
      type: "row",
      left: "TOTAL",
      right: money(bill.total),
      bold: true,
    })
  }

  if (payload.refund) {
    doc.push({ type: "feed", lines: 1 })
    doc.push({
      type: "row",
      left: "Dikembalikan",
      right: `-${money(payload.refund.amount)}`,
      bold: true,
    })
    for (const line of wrap(`Alasan: ${payload.refund.reason}`, columns))
      doc.push({ type: "text", text: line })
  }

  const payment = payload.refund ? null : payload.payment
  if (receipt && payment && bill) {
    doc.push({ type: "feed", lines: 1 })
    if (payment.amount !== bill.total)
      doc.push({ type: "row", left: "Dibayar", right: money(payment.amount) })
    doc.push({ type: "row", left: "Tunai", right: money(payment.tendered) })
    doc.push({
      type: "row",
      left: "Kembali",
      right: money(payment.change),
      bold: true,
    })
    const left = bill.total - (payload.paid ?? 0)
    if (left > 0)
      doc.push({ type: "row", left: "Sisa tagihan", right: money(left) })
  }

  doc.push({ type: "feed", lines: 1 })
  const footer = payload.outlet?.footer || (receipt ? "Terima kasih" : "")
  for (const line of footer.split("\n").filter(Boolean))
    wrap(line, columns).forEach((text) =>
      doc.push({ type: "text", text, align: "center" })
    )
  if (!receipt)
    doc.push({
      type: "text",
      text: "Bukan bukti pembayaran",
      align: "center",
    })
  return doc
}

/** The close-of-shift report: what the drawer should hold, what was counted, and the difference. */
export function shiftTicket(
  payload: TicketPayload,
  columns: Columns
): TicketDoc {
  const shift = payload.shift
  if (!shift) return testTicket(payload, columns)
  const doc: Block[] = [
    {
      type: "text",
      text: " LAPORAN SHIFT ",
      align: "center",
      bold: true,
      invert: true,
    },
    { type: "feed", lines: 1 },
    {
      type: "row",
      left: "Buka",
      right: dateTime.format(new Date(shift.opened_at)),
    },
  ]
  if (shift.closed_at)
    doc.push({
      type: "row",
      left: "Tutup",
      right: dateTime.format(new Date(shift.closed_at)),
    })
  doc.push(
    { type: "row", left: "Dibuka oleh", right: shift.opened_by },
    { type: "row", left: "Ditutup oleh", right: payload.by },
    { type: "rule" },
    { type: "row", left: "Modal awal", right: money(shift.opening_cash) },
    { type: "row", left: "Penjualan tunai", right: money(shift.cash_sales) },
    { type: "row", left: "Kas masuk", right: money(shift.cash_in) },
    { type: "row", left: "Kas keluar", right: `-${money(shift.cash_out)}` },
    ...(shift.refunds
      ? [
          {
            type: "row" as const,
            left: "Refund",
            right: `-${money(shift.refunds)}`,
          },
        ]
      : []),
    { type: "rule" },
    {
      type: "row",
      left: "Seharusnya di laci",
      right: money(shift.expected_cash),
      bold: true,
    }
  )
  if (shift.counted_cash !== null)
    doc.push({
      type: "row",
      left: "Dihitung",
      right: money(shift.counted_cash),
    })
  if (shift.variance !== null)
    doc.push({
      type: "row",
      left: "Selisih",
      right: `${shift.variance > 0 ? "+" : shift.variance < 0 ? "-" : ""}${money(Math.abs(shift.variance))}`,
      bold: true,
    })
  doc.push(
    { type: "rule" },
    { type: "row", left: "Transaksi", right: String(shift.payments) }
  )
  if (shift.unpaid_bills)
    doc.push({
      type: "row",
      left: "Tagihan belum dibayar",
      right: String(shift.unpaid_bills),
      bold: true,
    })
  if (shift.movements.length) {
    doc.push({ type: "rule" })
    for (const movement of shift.movements)
      doc.push({
        type: "row",
        left: movement.reason,
        right: `${movement.kind === "out" ? "-" : "+"}${money(movement.amount)}`,
      })
  }
  doc.push({ type: "feed", lines: 2 })
  doc.push({ type: "text", text: "Tanda tangan kasir:" })
  doc.push({ type: "feed", lines: 2 })
  doc.push({ type: "rule" })
  return doc
}

/** The layout for any job the station receives. */
export function ticketFor(payload: TicketPayload, columns: Columns): TicketDoc {
  switch (payload.kind) {
    case "test":
      return testTicket(payload, columns)
    case "bill":
    case "receipt":
      return billTicket(payload, columns)
    case "shift":
      return shiftTicket(payload, columns)
    default:
      return kitchenTicket(payload, columns)
  }
}
