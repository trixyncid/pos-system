import { useCallback, useEffect, useRef, useState } from "react"

import { useAckJob } from "@/features/printing/api/print-jobs.ts"
import { encode, type Columns } from "@/features/printing/lib/ticket-doc.ts"
import { ticketFor } from "@/features/printing/lib/tickets.ts"
import type { PrintTransport } from "@/features/printing/lib/transport.ts"
import type { PrintJob } from "@/features/printing/schemas/print-job.ts"

/**
 * Prints every queued job, one at a time and oldest first, then reports it
 * printed or failed. A job is never started twice on this tablet, even when
 * the list refetches while it prints. `retry` prints a failed job again.
 */
export function useAutoPrint(
  jobs: PrintJob[] | undefined,
  transport: PrintTransport,
  columns: Columns
) {
  const { mutateAsync: ack } = useAckJob()
  const started = useRef(new Set<string>())
  const busy = useRef(false)
  const [printing, setPrinting] = useState<string | null>(null)

  const printOne = useCallback(
    async (job: PrintJob) => {
      busy.current = true
      started.current.add(job.id)
      setPrinting(job.id)
      try {
        await transport.print(encode(ticketFor(job.payload, columns), columns))
        await ack({ id: job.id, status: "printed" })
      } catch (error) {
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
    [transport, columns, ack]
  )

  useEffect(() => {
    if (busy.current || printing) return
    const next = jobs?.find(
      (job) => job.status === "queued" && !started.current.has(job.id)
    )
    if (next) void printOne(next)
  }, [jobs, printing, printOne])

  const retry = (job: PrintJob) => {
    if (!busy.current) void printOne(job)
  }

  return { printing, retry }
}
