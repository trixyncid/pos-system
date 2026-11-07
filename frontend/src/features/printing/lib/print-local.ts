import { COLUMNS } from "@/features/printing/components/print-runner.tsx"
import {
  useDevicePrinting,
  type Station,
} from "@/features/printing/lib/device.ts"
import { encode } from "@/features/printing/lib/ticket-doc.ts"
import { ticketFor } from "@/features/printing/lib/tickets.ts"
import {
  AgentTransport,
  PreviewTransport,
} from "@/features/printing/lib/transport.ts"
import type { TicketPayload } from "@/features/printing/schemas/print-job.ts"

/**
 * Prints tickets straight from this device, without the server's queue: for
 * a sale made while the internet was down. Only the device chosen as the
 * printer (the cashier PC) can, and only for stations it prints. Resolves
 * true when every ticket printed, so the server knows not to print them
 * again when the sale syncs; false means the server prints them then.
 */
export async function printLocally(payloads: TicketPayload[]) {
  const { enabled, mode, agentUrl, printers, stations, drawer } =
    useDevicePrinting.getState()
  if (!enabled) return false
  if (payloads.some((p) => !stations.includes(p.station as Station)))
    return false
  const transport =
    mode === "agent"
      ? new AgentTransport(agentUrl, printers)
      : new PreviewTransport()
  try {
    for (const payload of payloads) {
      // A cash sale's receipt opens the drawer, as it does when printed from the queue.
      const opens =
        mode === "agent" &&
        drawer &&
        payload.kind === "receipt" &&
        payload.payment?.method === "cash"
      const bytes = encode(ticketFor(payload, COLUMNS), COLUMNS, {
        drawer: opens,
      })
      await transport.print(bytes, payload.station as Station)
    }
    return true
  } catch {
    return false
  }
}
