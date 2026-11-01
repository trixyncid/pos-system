import { formatPrinter, parsePrinter } from "@/features/printing/lib/device.ts"
import { encode } from "@/features/printing/lib/ticket-doc.ts"
import { opensDrawer } from "@/features/printing/lib/use-auto-print.ts"
import type { PrintJob } from "@/features/printing/schemas/print-job.ts"

describe("printer addresses", () => {
  it("reads a LAN printer, with or without a port, and a shared USB printer", () => {
    expect(parsePrinter("192.168.1.50")).toEqual({
      type: "tcp",
      host: "192.168.1.50",
      port: 9100,
    })
    expect(parsePrinter(" 192.168.1.51:9101 ")).toEqual({
      type: "tcp",
      host: "192.168.1.51",
      port: 9101,
    })
    expect(parsePrinter("share:XS80")).toEqual({ type: "share", name: "XS80" })
    expect(parsePrinter("")).toBeNull()
    expect(parsePrinter("192.168.1.50:99999")).toBeNull()
    expect(parsePrinter("http://printer")).toBeNull()
  })

  it("writes them back the way they were typed", () => {
    expect(
      formatPrinter({ type: "tcp", host: "192.168.1.50", port: 9100 })
    ).toBe("192.168.1.50")
    expect(formatPrinter({ type: "tcp", host: "10.0.0.9", port: 9101 })).toBe(
      "10.0.0.9:9101"
    )
    expect(formatPrinter({ type: "share", name: "XS80" })).toBe("share:XS80")
  })
})

describe("cash drawer", () => {
  const job = (payload: Partial<PrintJob["payload"]>, kind = "receipt") =>
    ({ kind, payload: { kind, ...payload } }) as unknown as PrintJob
  const cash = { method: "cash", amount: 9_200, tendered: 10_000, change: 800 }

  it("opens only for a cash receipt", () => {
    expect(opensDrawer(job({ payment: cash }))).toBe(true)
    expect(opensDrawer(job({ payment: { ...cash, method: "qris" } }))).toBe(
      false
    )
    expect(
      opensDrawer(
        job({ payment: cash, refund: { amount: 9_200, reason: "x" } })
      )
    ).toBe(false)
    expect(opensDrawer(job({}, "bill"))).toBe(false)
  })

  it("adds the drawer pulse (ESC p) after the cut", () => {
    const pulse = [0x1b, 0x70]
    const has = (bytes: Uint8Array) =>
      bytes.some((byte, i) => byte === pulse[0] && bytes[i + 1] === pulse[1])
    const doc = [{ type: "text" as const, text: "Terima kasih" }]
    expect(has(encode(doc, 48))).toBe(false)
    expect(has(encode(doc, 48, { drawer: true }))).toBe(true)
  })
})
