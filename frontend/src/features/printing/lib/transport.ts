import type { PrinterTarget, Station } from "@/features/printing/lib/device.ts"

/**
 * How bytes reach a printer. The print runner picks one transport; the rest
 * of the app never knows which.
 *
 * - PreviewTransport: development and demo mode. "Prints" by keeping the
 *   bytes, which the Print station page shows as on-screen tickets.
 * - AgentTransport: the cashier PC. Sends the bytes to the print agent on
 *   the same PC (print-agent/), which passes them to the LAN printer on
 *   port 9100 or to a Windows shared USB printer.
 */
export interface PrintTransport {
  readonly name: string
  print(bytes: Uint8Array, station: Station): Promise<void>
}

export class PreviewTransport implements PrintTransport {
  readonly name = "Preview"

  async print() {
    // A short pause, like a real printer, so the queue animation is visible.
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
}

export class AgentError extends Error {}
/** The agent itself is not answering (not started, or restarting): the job waits rather than fails. */
export class AgentOfflineError extends AgentError {}

function base64(bytes: Uint8Array) {
  let text = ""
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}

async function callAgent(
  agentUrl: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; error?: string; version?: string }> {
  let response: Response
  try {
    response = await fetch(`${agentUrl.replace(/\/$/, "")}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new AgentOfflineError("Print agent is not running on this PC.")
  }
  if (response.status === 403)
    throw new AgentError(
      "Print agent refuses this address. Add it to agent.json."
    )
  const result = (await response.json().catch(() => ({ ok: false }))) as {
    ok: boolean
    error?: string
    version?: string
  }
  if (!result.ok)
    throw new AgentError(result.error ?? "Printer did not answer.")
  return result
}

export class AgentTransport implements PrintTransport {
  readonly name = "Agent"

  private readonly agentUrl: string
  private readonly printers: Partial<Record<Station, PrinterTarget>>

  constructor(
    agentUrl: string,
    printers: Partial<Record<Station, PrinterTarget>>
  ) {
    this.agentUrl = agentUrl
    this.printers = printers
  }

  async print(bytes: Uint8Array, station: Station) {
    const target = this.printers[station]
    if (!target) throw new AgentError(`No printer is set for ${station}.`)
    await callAgent(this.agentUrl, "/print", { target, data: base64(bytes) })
  }
}

/** Is the agent running? Resolves to its version, or throws AgentError. */
export async function agentStatus(agentUrl: string) {
  const result = await callAgent(agentUrl, "/status")
  return result.version ?? ""
}

/** Can the agent reach this printer? Throws AgentError when it cannot. */
export async function checkPrinter(agentUrl: string, target: PrinterTarget) {
  await callAgent(agentUrl, "/check", { target })
}
