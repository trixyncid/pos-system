import {
  CalendarDaysIcon,
  ClockIcon,
  PlusIcon,
  StoreIcon,
  TicketPercentIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { Pressable } from "@/components/motion/pressable.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import {
  usePromosQuery,
  useSetPromoActive,
} from "@/features/promos/api/promos.ts"
import { PromoFormSheet } from "@/features/promos/components/promo-form-sheet.tsx"
import {
  describeBenefit,
  describeDays,
  describeHours,
  describeLimits,
  promoState,
  type PromoState,
} from "@/features/promos/lib/describe.ts"
import type { Promo } from "@/features/promos/schemas/promo.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { today } from "@/lib/dates.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"
import { dateFormat } from "@/lib/locale-format.ts"

const stateTone = {
  on: "success",
  later: "info",
  ended: "neutral",
  off: "neutral",
} as const satisfies Record<PromoState, string>

const shortDate = dateFormat({
  day: "numeric",
  month: "short",
})

function PromoCard({ promo, onEdit }: { promo: Promo; onEdit: () => void }) {
  const { t, i18n } = useTranslation()
  const setActive = useSetPromoActive()
  const state = promoState(promo, today())
  const days = describeDays(promo.weekdays, i18n.language)
  const hours = describeHours(promo)
  const dates =
    promo.starts_on || promo.ends_on
      ? [promo.starts_on, promo.ends_on]
          .map((d) => (d ? shortDate.format(new Date(`${d}T00:00`)) : "…"))
          .join(" – ")
      : null

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring.layout}
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl bg-card shadow-(--shadow-soft)",
        state !== "on" && "opacity-70"
      )}
    >
      <Pressable
        pressScale={0.99}
        onClick={onEdit}
        className="flex flex-1 flex-col text-left"
      >
        {promo.image_url ? (
          <img
            src={promo.image_url}
            alt=""
            className="aspect-5/2 w-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-full items-center bg-linear-to-br from-primary/25 to-chart-3/20 px-4">
            <TicketPercentIcon className="size-7 text-primary" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading text-lg leading-tight font-semibold">
              {promo.name}
            </p>
            <StatusPill tone={stateTone[state]} className="shrink-0">
              {t(`promos.state.${state}`)}
            </StatusPill>
          </div>
          <p className="font-medium text-primary">
            {describeBenefit(promo, t)}
          </p>
          {describeLimits(promo, t).length > 0 && (
            <p className="text-sm text-muted-foreground">
              {describeLimits(promo, t).join(" · ")}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDaysIcon className="size-3.5" />
              {days ?? t("promos.everyDay")}
              {dates && ` · ${dates}`}
            </span>
            {hours && (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-3.5" />
                {hours}
              </span>
            )}
            {promo.channel !== "all" && (
              <span className="inline-flex items-center gap-1">
                <StoreIcon className="size-3.5" />
                {t(`promos.channel.${promo.channel}`)}
              </span>
            )}
          </div>
        </div>
      </Pressable>
      <label className="flex h-12 cursor-pointer items-center justify-between border-t px-4 text-sm text-muted-foreground">
        {promo.is_active ? t("promos.on") : t("promos.off")}
        <Switch
          checked={promo.is_active}
          aria-label={t("promos.form.active")}
          onCheckedChange={(is_active) =>
            setActive.mutate(
              { id: promo.id, is_active },
              {
                onSuccess: () =>
                  toast.success(
                    t(is_active ? "promos.turnedOn" : "promos.turnedOff", {
                      name: promo.name,
                    })
                  ),
              }
            )
          }
        />
      </label>
    </motion.li>
  )
}

export function PromosPage() {
  const { t } = useTranslation()
  const promos = usePromosQuery()
  const [filter, setFilter] = useState<"active" | "all">("active")
  const [editing, setEditing] = useState<Promo | null | undefined>(undefined)
  const shown = (promos.data ?? []).filter(
    (promo) => filter === "all" || promo.is_active
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title={t("promos.title")}
        description={t("promos.subtitle")}
        actions={
          <Button size="touch" onClick={() => setEditing(null)}>
            <PlusIcon />
            {t("promos.add")}
          </Button>
        }
      />
      <Segmented
        label={t("promos.title")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "active", label: t("promos.filterActive") },
          { value: "all", label: t("promos.filterAll") },
        ]}
      />
      {promos.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-3xl" />
          ))}
        </div>
      ) : promos.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(promos.error)}</p>
      ) : shown.length === 0 ? (
        <div className="space-y-4 py-16 text-center text-muted-foreground">
          <TicketPercentIcon className="mx-auto size-10 opacity-40" />
          <p>{t("promos.empty")}</p>
        </div>
      ) : (
        <ul className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {shown.map((promo) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                onEdit={() => setEditing(promo)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <PromoFormSheet promo={editing} onClose={() => setEditing(undefined)} />
    </div>
  )
}
