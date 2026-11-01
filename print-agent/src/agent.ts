/**
 * The print agent: a tiny HTTP server on 127.0.0.1 that the POS page calls
 * with ESC/POS bytes and a printer to send them to. A browser cannot open a
 * raw socket to a printer; this program can.
 *
 *   GET  /status                       → { ok, version }
 *   POST /check  { target }            → { ok, error? }   is the printer reachable?
 *   POST /print  { target, data }      → { ok, error? }   data is base64 ESC/POS
 *
 * A target is a LAN printer `{ type: "tcp", host, port? }` (raw port 9100)
 * or a Windows shared printer `{ type: "share", name }` (USB printers).
 * Only the POS origins in the config may call it, so no other website can
 * print on the outlet's printers.
 */
import { writeFile } from "node:fs/promises"
import { createConnection } from "node:net"

export const VERSION = "1.0.0"
const TIMEOUT_MS = 5_000
const MAX_BYTES = 512 * 1024

export type Target =
  | { type: "tcp"; host: string; port?: number }
  | { type: "share"; name: string }

export type AgentConfig = {
  port: number
  /** Origins allowed to print, e.g. "https://pos.yicipang.example". "*" allows any (testing only). */
  allowedOrigins: string[]
}

export class PrintError extends Error {}

function parseTarget(value: unknown): Target {
  const target = value as Partial<Record<string, unknown>> | null
  if (target?.type === "tcp" && typeof target.host === "string" && target.host.trim()) {
    const port = target.port === undefined ? 9100 : Number(target.port)
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new PrintError("Invalid printer port.")
    return { type: "tcp", host: target.host.trim(), port }
  }
  if (target?.type === "share" && typeof target.name === "string" && /^[\w .-]{1,80}$/.test(target.name)) {
    return { type: "share", name: target.name.trim() }
  }
  throw new PrintError("Invalid printer address.")
}

function describe(target: Target) {
  return target.type === "tcp" ? `${target.host}:${target.port ?? 9100}` : `\\\\localhost\\${target.name}`
}

/** Open a socket to the printer, write the bytes, wait until they are flushed. */
function sendTcp(host: string, port: number, bytes: Uint8Array | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new PrintError(`Printer ${host}:${port} did not answer.`))
    }, TIMEOUT_MS)
    const done = (error?: Error) => {
      clearTimeout(timer)
      if (error) reject(new PrintError(`Printer ${host}:${port}: ${error.message}`))
      else resolve()
    }
    socket.once("error", (error) => done(error))
    socket.once("connect", () => {
      if (!bytes) {
        socket.end(() => done())
        return
      }
      socket.end(Buffer.from(bytes), () => done())
    })
  })
}

/**
 * A USB printer shared in Windows ("XS80"): writing to \\localhost\XS80
 * passes the bytes straight to the printer, as `copy /b file \\localhost\XS80` does.
 */
async function sendShare(name: string, bytes: Uint8Array | null) {
  if (process.platform !== "win32") throw new PrintError("Shared printers work on Windows only.")
  const path = `\\\\localhost\\${name}`
  try {
    // An empty write is enough to check that the share exists and accepts jobs.
    await writeFile(path, bytes ?? new Uint8Array())
  } catch (error) {
    throw new PrintError(`Printer ${path}: ${(error as Error).message}`)
  }
}

// One job at a time per printer, so two tickets never interleave on the paper.
const lanes = new Map<string, Promise<unknown>>()
function inLane<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = lanes.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(work)
  lanes.set(key, next)
  return next
}

export function send(target: Target, bytes: Uint8Array | null) {
  return inLane(describe(target), () =>
    target.type === "tcp" ? sendTcp(target.host, target.port ?? 9100, bytes) : sendShare(target.name, bytes)
  )
}

function decode(data: unknown): Uint8Array {
  if (typeof data !== "string" || !data) throw new PrintError("No ticket to print.")
  const bytes = Uint8Array.from(Buffer.from(data, "base64"))
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new PrintError("Ticket is empty or too large.")
  return bytes
}

function allowed(config: AgentConfig, origin: string | null) {
  // Requests with no Origin come from local tools (curl, the setup script), not from a website.
  if (origin === null) return true
  return config.allowedOrigins.includes("*") || config.allowedOrigins.includes(origin)
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // Chrome asks before a public site may reach a local address (Private Network Access).
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  })
}

export function createHandler(config: AgentConfig, log: (line: string) => void = () => {}) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("Origin")
    const { pathname } = new URL(request.url)
    if (!allowed(config, origin)) {
      log(`refused ${request.method} ${pathname} from ${origin}`)
      return new Response("Origin not allowed", { status: 403 })
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) })

    try {
      if (request.method === "GET" && pathname === "/status") return json({ ok: true, version: VERSION }, 200, origin)
      if (request.method === "POST" && (pathname === "/print" || pathname === "/check")) {
        const body = (await request.json().catch(() => null)) as { target?: unknown; data?: unknown } | null
        const target = parseTarget(body?.target)
        if (pathname === "/check") {
          await send(target, null)
          return json({ ok: true }, 200, origin)
        }
        const bytes = decode(body?.data)
        await send(target, bytes)
        log(`printed ${bytes.length} bytes on ${describe(target)}`)
        return json({ ok: true }, 200, origin)
      }
      return json({ ok: false, error: "Not found." }, 404, origin)
    } catch (error) {
      const message = error instanceof PrintError ? error.message : "The agent could not print."
      log(`error: ${message}`)
      return json({ ok: false, error: message }, error instanceof PrintError ? 502 : 500, origin)
    }
  }
}
