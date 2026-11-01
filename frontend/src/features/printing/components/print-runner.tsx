import { useEffect, useMemo } from "react"
import { create } from "zustand"

import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { usePrintJobsQuery } from "@/features/printing/api/print-jobs.ts"
import { useDevicePrinting } from "@/features/printing/lib/device.ts"
import type { Columns } from "@/features/printing/lib/ticket-doc.ts"
import {
  AgentTransport,
  PreviewTransport,
} from "@/features/printing/lib/transport.ts"
import { useAutoPrint } from "@/features/printing/lib/use-auto-print.ts"
import type { PrintJob } from "@/features/printing/schemas/print-job.ts"

export const COLUMNS: Columns = 48

/** What the runner is doing, for the Print station page to show (and retry through). */
export const usePrintRunner = create<{
  printing: string | null
  retry: ((job: PrintJob) => void) | null
}>()(() => ({ printing: null, retry: null }))

function Runner() {
  const { mode, agentUrl, printers, stations, drawer } = useDevicePrinting()
  const jobs = usePrintJobsQuery(stations)
  const transport = useMemo(
    () =>
      mode === "agent"
        ? new AgentTransport(agentUrl, printers)
        : new PreviewTransport(),
    [mode, agentUrl, printers]
  )
  const { printing, retry } = useAutoPrint(jobs.data, transport, COLUMNS, {
    drawer: mode === "agent" && drawer,
  })

  useEffect(() => {
    usePrintRunner.setState({ printing, retry })
  }, [printing, retry])
  useEffect(
    () => () => usePrintRunner.setState({ printing: null, retry: null }),
    []
  )
  return null
}

/**
 * Prints the queue in the background on the device chosen as the printer
 * (the cashier PC), whichever screen is open: kitchen tickets as orders are
 * sent, bills and receipts at the counter. Mounted once for every signed-in
 * screen; does nothing elsewhere.
 */
export function PrintRunner() {
  const enabled = useDevicePrinting((state) => state.enabled)
  const canPrint = useCan(perm.printStation)
  const stations = useDevicePrinting((state) => state.stations)
  if (!enabled || !canPrint || stations.length === 0) return null
  return <Runner />
}
