import { PrinterIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Segmented } from "@/components/pos/segmented.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { Can } from "@/features/auth/components/can.tsx"
import { perm } from "@/features/auth/lib/permissions.ts"
import {
  usePrintJobsQuery,
  useReprint,
  useTestPrint,
} from "@/features/printing/api/print-jobs.ts"
import {
  COLUMNS,
  usePrintRunner,
} from "@/features/printing/components/print-runner.tsx"
import { TicketPreview } from "@/features/printing/components/ticket-preview.tsx"
import {
  formatPrinter,
  parsePrinter,
  STATIONS,
  useDevicePrinting,
  type Station,
} from "@/features/printing/lib/device.ts"
import { ticketFor } from "@/features/printing/lib/tickets.ts"
import { agentStatus, checkPrinter } from "@/features/printing/lib/transport.ts"
import type { PrintJob } from "@/features/printing/schemas/print-job.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

function JobCard({
  job,
  printing,
  onRetry,
}: {
  job: PrintJob
  printing: boolean
  onRetry: (() => void) | null
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
          {job.status === "failed" && onRetry && (
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

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-(--shadow-soft)">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  )
}

/** One station: printed here or not, its printer's address, a reachability check and a test page. */
function StationRow({ station }: { station: Station }) {
  const { t } = useTranslation()
  const { stations, printers, mode, agentUrl, update } = useDevicePrinting()
  const test = useTestPrint()
  const on = stations.includes(station)
  const [draft, setDraft] = useState(formatPrinter(printers[station]))
  const [checking, setChecking] = useState(false)
  const label = t(`station.${station}`)

  const save = () => {
    const target = parsePrinter(draft)
    if (draft.trim() && !target) {
      toast.error(t("station.badAddress"))
      return
    }
    const next = { ...printers }
    if (target) next[station] = target
    else delete next[station]
    update({ printers: next })
  }

  const check = async () => {
    const target = parsePrinter(draft)
    if (!target) {
      toast.error(t("station.badAddress"))
      return
    }
    setChecking(true)
    try {
      await checkPrinter(agentUrl, target)
      toast.success(t("station.reachable", { station: label }))
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border p-3">
      <label className="flex items-center gap-3 font-medium">
        <Switch
          checked={on}
          onCheckedChange={(checked) =>
            update({
              stations: checked
                ? [...stations, station]
                : stations.filter((s) => s !== station),
            })
          }
        />
        <span className="flex-1">{label}</span>
      </label>
      {on && mode === "agent" && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
            placeholder={t("station.addressPlaceholder")}
            aria-label={t("station.address", { station: label })}
            className="h-11 rounded-xl"
          />
          <Button
            type="button"
            variant="outline"
            size="touch"
            className="px-3"
            disabled={checking || !draft.trim()}
            onClick={() => void check()}
          >
            {checking ? <Spinner /> : t("station.check")}
          </Button>
        </div>
      )}
      {on && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={test.isPending}
          onClick={() =>
            test.mutate(station, {
              onSuccess: () =>
                toast.success(t("station.testSent", { station: label })),
            })
          }
        >
          <PrinterIcon />
          {t("station.test", { station: label })}
        </Button>
      )}
    </div>
  )
}

/**
 * Printing for this device. On the cashier PC: turn printing on, point each
 * station at its printer (through the print agent), check and test them,
 * and watch the queue. Printing itself runs in the background on every
 * screen (PrintRunner), so the cashier never needs to keep this page open.
 */
export function PrintStationPage() {
  const { t } = useTranslation()
  const settings = useDevicePrinting()
  const { enabled, mode, agentUrl, stations, drawer, update } = settings
  const jobs = usePrintJobsQuery(stations)
  const { printing, retry } = usePrintRunner()
  const agent = useQuery({
    queryKey: ["print-agent", agentUrl],
    queryFn: () => agentStatus(agentUrl),
    enabled: mode === "agent",
    refetchInterval: 10_000,
    retry: false,
  })

  const recent = [...(jobs.data ?? [])].reverse().slice(0, 30)
  const printed =
    jobs.data?.filter((job) => job.status === "printed").length ?? 0
  const failed = jobs.data?.filter((job) => job.status === "failed").length ?? 0

  return (
    <div className="grid h-full min-h-0 grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="space-y-4 overflow-y-auto border-r p-5">
        <div>
          <h1 className="font-heading text-xl font-semibold">
            {t("station.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("station.subtitle")}
          </p>
        </div>

        <Card title={t("station.thisDevice")}>
          <label className="flex items-start gap-3">
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => update({ enabled: checked })}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium">{t("station.enabled")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("station.enabledHint")}
              </span>
            </span>
          </label>
        </Card>

        <Card title={t("station.transport")}>
          <Segmented
            label={t("station.transport")}
            value={mode}
            onChange={(next) => update({ mode: next })}
            options={[
              { value: "agent", label: t("station.transports.Agent") },
              { value: "preview", label: t("station.transports.Preview") },
            ]}
            className="w-full *:flex-1"
          />
          {mode === "agent" ? (
            <>
              <p className="flex items-center gap-2 text-sm font-medium">
                <PrinterIcon className="size-4 text-primary" />
                {t("station.agent")}
                <StatusPill
                  tone={
                    agent.isSuccess
                      ? "success"
                      : agent.isPending
                        ? "neutral"
                        : "danger"
                  }
                  pulse={agent.isSuccess}
                  className="ml-auto"
                >
                  {agent.isSuccess
                    ? t("station.ready")
                    : agent.isPending
                      ? t("station.checking")
                      : t("station.offline")}
                </StatusPill>
              </p>
              {agent.isError && (
                <p className="text-xs text-danger-ink">
                  {(agent.error as Error).message}
                </p>
              )}
              <Input
                defaultValue={agentUrl}
                onBlur={(event) =>
                  update({ agentUrl: event.target.value.trim() || agentUrl })
                }
                aria-label={t("station.agentUrl")}
                className="h-10 rounded-xl text-xs"
              />
              <label className="flex items-center gap-3 text-sm">
                <Switch
                  checked={drawer}
                  onCheckedChange={(checked) => update({ drawer: checked })}
                />
                {t("station.drawer")}
              </label>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("station.previewNote")}
            </p>
          )}
        </Card>

        <Card title={t("station.stations")}>
          {STATIONS.map((station) => (
            <StationRow key={station} station={station} />
          ))}
          {stations.length === 0 && (
            <p className="text-sm text-warning-ink">
              {t("station.pickStation")}
            </p>
          )}
        </Card>

        <p className="text-sm text-muted-foreground">
          {t("station.today")}: {t("station.stats", { printed, failed })}
        </p>
      </aside>

      <section className="min-h-0 overflow-y-auto p-6">
        {!enabled && (
          <p className="mb-6 rounded-2xl bg-warning/15 p-4 text-sm text-warning-ink">
            {t("station.notPrinting")}
          </p>
        )}
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
                  onRetry={retry ? () => retry(job) : null}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  )
}
