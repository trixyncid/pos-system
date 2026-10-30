import { SearchIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useDeferredValue, useState } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { Pager } from "@/components/backoffice/pager.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import { StatusPill, type StatusTone } from "@/components/pos/status-pill.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { useAuditQuery } from "@/features/audit/api/audit.ts"
import type { AuditEvent } from "@/features/audit/schemas/audit.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { today } from "@/lib/dates.ts"
import { formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

const GROUPS = [
  { value: "", key: "all" },
  { value: "order.", key: "order" },
  { value: "shift.", key: "shift" },
  { value: "stock.", key: "stock" },
  { value: "auth.", key: "auth" },
] as const

const when = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

/** Money-ish keys print as rupiah; the rest as they are. */
const MONEY = new Set([
  "amount",
  "total",
  "opening_cash",
  "counted",
  "expected",
  "variance",
])

function tone(action: string): StatusTone {
  if (
    action.includes("void") ||
    action.includes("waste") ||
    action.includes("fail")
  )
    return "danger"
  if (action.includes("discount") || action.includes("reprint"))
    return "warning"
  if (action.startsWith("shift.") || action.startsWith("stock.")) return "info"
  if (action.includes("payment") || action.includes("sale")) return "success"
  return "neutral"
}

function details(event: AuditEvent) {
  const { kind } = event.metadata
  return (
    Object.entries(event.metadata)
      // A discount's kind is shown through its value: "10%" or "Rp 5.000".
      .filter(
        ([key, value]) =>
          key !== "kind" &&
          value !== null &&
          value !== "" &&
          typeof value !== "object"
      )
      .slice(0, 4)
      .map(([key, value]) => {
        let text = String(value)
        if (typeof value === "number" && MONEY.has(key))
          text = `${key === "variance" && value > 0 ? "+" : ""}${formatIDR(value)}`
        else if (typeof value === "number" && key === "value")
          text = kind === "percent" ? `${value}%` : formatIDR(value)
        return { key, text }
      })
  )
}

function Row({ event }: { event: AuditEvent }) {
  const { t } = useTranslation()
  const label = t(`audit.actions.${event.action}`, {
    defaultValue: event.action,
  })
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring.layout}
      className="flex items-start gap-3 px-4 py-3"
    >
      <StaffAvatar name={event.actor_name || "?"} size="sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {event.actor_name || t("audit.system")}
          </span>
          <StatusPill tone={tone(event.action)}>{label}</StatusPill>
          {event.target_label && (
            <span className="truncate text-sm text-muted-foreground">
              {event.target_label}
            </span>
          )}
        </p>
        {details(event).length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {details(event).map(({ key, text }) => (
              <span
                key={key}
                className="rounded-lg bg-muted px-2 py-0.5 text-xs"
              >
                <span className="text-muted-foreground">
                  {t(`audit.keys.${key}`, { defaultValue: key })}:
                </span>{" "}
                <span className="tabular-nums">{text}</span>
              </span>
            ))}
          </p>
        )}
      </div>
      <time
        dateTime={event.created_at}
        className="shrink-0 text-xs text-muted-foreground tabular-nums"
      >
        {when.format(new Date(event.created_at))}
      </time>
    </motion.li>
  )
}

export function AuditPage() {
  const { t } = useTranslation()
  const [group, setGroup] = useState<(typeof GROUPS)[number]["value"]>("")
  const [search, setSearch] = useState("")
  const [date, setDate] = useState("")
  const [page, setPage] = useState(1)
  const events = useAuditQuery({
    action: group || undefined,
    search: useDeferredValue(search.trim()) || undefined,
    date: date || undefined,
    page,
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader title={t("audit.title")} description={t("audit.subtitle")} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t("audit.search")}
            aria-label={t("audit.search")}
            className="h-12 rounded-xl pl-12 text-base"
          />
        </div>
        <Input
          type="date"
          value={date}
          max={today()}
          onChange={(event) => {
            setDate(event.target.value)
            setPage(1)
          }}
          aria-label={t("audit.date")}
          className="h-12 w-44 rounded-xl"
        />
      </div>
      <Segmented
        label={t("audit.group")}
        value={group}
        onChange={(next) => {
          setGroup(next)
          setPage(1)
        }}
        options={GROUPS.map(({ value, key }) => ({
          value,
          label: t(`audit.groups.${key}`),
        }))}
      />
      {events.isPending ? (
        <Skeleton className="h-96 rounded-3xl" />
      ) : events.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(events.error)}</p>
      ) : events.data.results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {t("audit.empty")}
        </p>
      ) : (
        <>
          <ul
            className={cn(
              "divide-y rounded-3xl bg-card shadow-(--shadow-soft) transition-opacity",
              events.isPlaceholderData && "opacity-60"
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {events.data.results.map((event) => (
                <Row key={event.id} event={event} />
              ))}
            </AnimatePresence>
          </ul>
          <Pager
            page={page}
            hasPrevious={Boolean(events.data.previous)}
            hasNext={Boolean(events.data.next)}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}
