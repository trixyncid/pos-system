import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { createServer, type Server } from "node:net"

import { createHandler } from "./agent.ts"

/** A stand-in LAN printer: collects every byte sent to it. */
let printer: Server
let printerPort = 0
const received: Buffer[] = []

beforeAll(async () => {
  printer = createServer((socket) => {
    const chunks: Buffer[] = []
    socket.on("data", (chunk) => chunks.push(chunk))
    socket.on("end", () => received.push(Buffer.concat(chunks)))
  })
  await new Promise<void>((resolve) => printer.listen(0, "127.0.0.1", resolve))
  printerPort = (printer.address() as { port: number }).port
})
afterAll(() => printer.close())

const handle = createHandler({ port: 0, allowedOrigins: ["https://pos.example"] })
const call = (path: string, init: RequestInit & { origin?: string } = {}) =>
  handle(
    new Request(`http://127.0.0.1:9123${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.origin === undefined ? { Origin: "https://pos.example" } : init.origin ? { Origin: init.origin } : {}),
      },
    })
  )

describe("print agent", () => {
  it("reports its status", async () => {
    const response = await call("/status")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
  })

  it("sends the ticket to a LAN printer, byte for byte", async () => {
    const ticket = Uint8Array.from([0x1b, 0x40, 0x48, 0x69, 0x0a, 0x1d, 0x56, 0x00])
    const response = await call("/print", {
      method: "POST",
      body: JSON.stringify({
        target: { type: "tcp", host: "127.0.0.1", port: printerPort },
        data: Buffer.from(ticket).toString("base64"),
      }),
    })
    expect(await response.json()).toEqual({ ok: true })
    await Bun.sleep(50)
    expect(Uint8Array.from(received.at(-1)!)).toEqual(ticket)
  })

  it("checks a printer without printing, and says when it is unreachable", async () => {
    const reachable = await call("/check", {
      method: "POST",
      body: JSON.stringify({ target: { type: "tcp", host: "127.0.0.1", port: printerPort } }),
    })
    expect(await reachable.json()).toEqual({ ok: true })
    const closed = await call("/check", {
      method: "POST",
      body: JSON.stringify({ target: { type: "tcp", host: "127.0.0.1", port: 1 } }),
    })
    expect(closed.status).toBe(502)
    expect((await closed.json()).ok).toBe(false)
  })

  it("refuses other websites, and answers Chrome's private-network preflight for the POS", async () => {
    expect((await call("/status", { origin: "https://evil.example" })).status).toBe(403)
    const preflight = await call("/print", { method: "OPTIONS" })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get("Access-Control-Allow-Private-Network")).toBe("true")
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("https://pos.example")
  })

  it("rejects a bad printer address or an empty ticket", async () => {
    const bad = await call("/print", { method: "POST", body: JSON.stringify({ target: { type: "tcp" }, data: "AA==" }) })
    expect(bad.status).toBe(502)
    const empty = await call("/print", {
      method: "POST",
      body: JSON.stringify({ target: { type: "tcp", host: "127.0.0.1", port: printerPort }, data: "" }),
    })
    expect(empty.status).toBe(502)
  })
})
