import {
  CheckCircle2Icon,
  CircleAlertIcon,
  PrinterIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { Can } from "@/features/auth/components/can.tsx"
import { perm } from "@/features/auth/lib/permissions.ts"
import {
  usePrintJobsQuery,
  useReprint,
  useTestPrint,
} from "@/features/printing/api/print-jobs.ts"
import { TicketPreview } from "@/features/printing/components/ticket-preview.tsx"
import type { Columns } from "@/features/printing/lib/ticket-doc.ts"
import { ticketFor } from "@/features/printing/lib/tickets.ts"
import { PreviewTransport } from "@/features/printing/lib/transport.ts"
import { useAutoPrint } from "@/features/printing/lib/use-auto-print.ts"
import type { PrintJob } from "@/features/printing/schemas/print-job.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

const STATIONS = ["kitchen", "bar", "cashier"] as const
const COLUMNS: Columns = 48
const storageKey = "pos.station.stations"

function storedStations(): string[] {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null"
    ) as unknown
    if (Array.isArray(value) && value.every((item) => typeof item === "string"))
      return value
  } catch {
    // Fall through to the default.
  }
  return [...STATIONS]
}

// One transport for the page's lifetime. The Android app swaps in a TCP transport (M10).
const transport = new PreviewTransport()

function JobCard({
  job,
  printing,
  onRetry,
}: {
  job: PrintJob
  printing: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const reprint = useReprint()
  const doc = useMemo(() => ticketFor(job.payload, COLUMNS), [job.payload])
  const status = printing ? "printing" : job.status

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: -24, clipPath: "inset(0 0 100% 0)" }}
      animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        ...spring.sheet,
        clipPath: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
      }}
      className="w-fit space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusPill
          tone={
            status === "printed"
              ? "success"
              : status === "failed"
                ? "danger"
                : "warning"
          }
          pulse={status === "printing" || status === "queued"}
        >
          {t(`station.${status}`)}
          {job.attempts > 1 && ` · ${job.attempts}×`}
        </StatusPill>
        <div className="flex gap-1">
          {job.status === "failed" && (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              <RefreshCwIcon />
              {t("station.retry")}
            </Button>
          )}
          {job.status === "printed" && job.kind !== "test" && (
            <Can permission={perm.reprint}>
              <Button
                size="sm"
                variant="ghost"
                disabled={reprint.isPending}
                onClick={async () => {
                  await reprint.mutateAsync(job.id)
                  toast.success(
                    t("station.reprinted", {
                      station: t(`station.${job.station as "kitchen"}`),
                    })
                  )
                }}
              >
                <RotateCcwIcon />
                {t("station.reprint")}
              </Button>
            </Can>
          )}
        </div>
      </div>
      <TicketPreview
        doc={doc}
        columns={COLUMNS}
        className={cn(status === "failed" && "ring-2 ring-danger")}
      />
      {job.error && <p className="text-xs text-danger-ink">{job.error}</p>}
    </motion.article>
  )
}

/**
 * The tablet next to the kitchen printer. It prints every ticket for its
 * stations as soon as an order is sent, and shows the last ones on screen.
 */
export function PrintStationPage() {
  const { t } = useTranslation()
  const [stations, setStations] = useState<string[]>(storedStations)
  const jobs = usePrintJobsQuery(stations)
  const test = useTestPrint()
  const { printing, retry } = useAutoPrint(jobs.data, transport, COLUMNS)

  const toggle = (station: string) =>
    setStations((current) => {
      const next = current.includes(station)
        ? current.filter((s) => s !== station)
        : [...current, station]
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Not saved; this tablet asks again after a reload.
      }
      return next
    })

  const recent = [...(jobs.data ?? [])].reverse().slice(0, 30)
  const printed =
    jobs.data?.filter((job) => job.status === "printed").length ?? 0
  const failed = jobs.data?.filter((job) => job.status === "failed").length ?? 0

  return (
    <div className="grid h-full min-h-0 grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-6 overflow-y-auto border-r p-5">
        <div>
          <h1 className="font-heading text-xl font-semibold">
            {t("station.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("station.subtitle")}
          </p>
        </div>

        <div className="space-y-2 rounded-2xl bg-card p-4 shadow-(--shadow-soft)">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("station.transport")}
          </p>
          <p className="flex items-center gap-2 font-medium">
            <PrinterIcon className="size-5 text-primary" />
            {transport.name}
            <StatusPill tone="success" pulse className="ml-auto">
              {t("station.ready")}
            </StatusPill>
          </p>
          <p className="text-xs text-muted-foreground">
            {t("station.previewNote")}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("station.stations")}
          </p>
          {STATIONS.map((station) => {
            const on = stations.includes(station)
            return (
              <Pressable
                key={station}
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(station)}
                className={cn(
                  "flex h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left font-medium transition-colors",
                  on
                    ? "border-primary bg-primary/10"
                    : "bg-background text-muted-foreground"
                )}
              >
                {on ? (
                  <CheckCircle2Icon className="size-5 text-primary" />
                ) : (
                  <CircleAlertIcon className="size-5" />
                )}
                {t(`station.${station}`)}
              </Pressable>
            )
          })}
          {stations.length === 0 && (
            <p className="text-sm text-warning-ink">
              {t("station.pickStation")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {stations.map((station) => (
            <Button
              key={station}
              variant="outline"
              size="touch"
              className="w-full"
              disabled={test.isPending}
              onClick={() =>
                test.mutate(station, {
                  onSuccess: () =>
                    toast.success(
                      t("station.testSent", {
                        station: t(`station.${station as "kitchen"}`),
                      })
                    ),
                })
              }
            >
              {test.isPending ? <Spinner /> : <PrinterIcon />}
              {t("station.test", {
                station: t(`station.${station as "kitchen"}`),
              })}
            </Button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {t("station.today")}: {t("station.stats", { printed, failed })}
        </p>
      </aside>

      <section className="min-h-0 overflow-y-auto p-6">
        {recent.length === 0 ? (
          <p className="py-24 text-center text-muted-foreground">
            {t("station.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(calc(48ch+2rem),1fr))] items-start gap-6">
            <AnimatePresence initial={false}>
              {recent.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  printing={printing === job.id}
                  onRetry={() => retry(job)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  )
}
