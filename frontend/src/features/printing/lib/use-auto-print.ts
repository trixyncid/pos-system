import { useCallback, useEffect, useRef, useState } from "react"

import { useAckJob } from "@/features/printing/api/print-jobs.ts"
import type { Station } from "@/features/printing/lib/device.ts"
import { encode, type Columns } from "@/features/printing/lib/ticket-doc.ts"
import { ticketFor } from "@/features/printing/lib/tickets.ts"
import {
  AgentOfflineError,
  type PrintTransport,
} from "@/features/printing/lib/transport.ts"
import type { PrintJob } from "@/features/printing/schemas/print-job.ts"

/** A cash sale's receipt opens the drawer; card, QRIS, bills and refunds don't. */
export function opensDrawer(job: PrintJob) {
  return (
    job.kind === "receipt" &&
    job.payload.payment?.method === "cash" &&
    !job.payload.refund
  )
}

/** While the agent is down, queued jobs wait and are tried again this often. */
const OFFLINE_RETRY_MS = 5_000

/**
 * Prints every queued job, one at a time and oldest first, then reports it
 * printed or failed. A job is never started twice on this device, even when
 * the list refetches while it prints. When the print agent is not running,
 * the job stays queued (nothing is lost) and printing resumes on its own
 * once the agent is back. `retry` prints a failed job again.
 */
export function useAutoPrint(
  jobs: PrintJob[] | undefined,
  transport: PrintTransport | null,
  columns: Columns,
  { drawer = false }: { drawer?: boolean } = {}
) {
  const { mutateAsync: ack } = useAckJob()
  const started = useRef(new Set<string>())
  const busy = useRef(false)
  const [printing, setPrinting] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)

  const printOne = useCallback(
    async (job: PrintJob) => {
      if (!transport) return
      busy.current = true
      started.current.add(job.id)
      setPrinting(job.id)
      try {
        const bytes = encode(ticketFor(job.payload, columns), columns, {
          drawer: drawer && opensDrawer(job),
        })
        await transport.print(bytes, job.station as Station)
        setWaiting(false)
        await ack({ id: job.id, status: "printed" })
      } catch (error) {
        if (error instanceof AgentOfflineError) {
          // Keep it queued; try again shortly (the effect below picks it up).
          setWaiting(true)
          window.setTimeout(() => {
            started.current.delete(job.id)
            setWaiting(false)
          }, OFFLINE_RETRY_MS)
          return
        }
        const message =
          error instanceof Error ? error.message : "Printer did not answer."
        await ack({
          id: job.id,
          status: "failed",
          error: message.slice(0, 200),
        }).catch(() => undefined)
      } finally {
        busy.current = false
        setPrinting(null)
      }
    },
    [transport, columns, drawer, ack]
  )

  useEffect(() => {
    if (!transport || busy.current || printing || waiting) return
    const next = jobs?.find(
      (job) => job.status === "queued" && !started.current.has(job.id)
    )
    if (next) void printOne(next)
  }, [jobs, transport, printing, waiting, printOne])

  const retry = useCallback(
    (job: PrintJob) => {
      if (!busy.current) void printOne(job)
    },
    [printOne]
  )

  return { printing, retry }
}
