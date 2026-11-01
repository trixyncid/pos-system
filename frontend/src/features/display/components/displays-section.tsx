import { MonitorIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import {
  useDisplaysQuery,
  useRemoveDisplay,
} from "@/features/display/api/display.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { dateFormat } from "@/lib/locale-format.ts"

const when = dateFormat({
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

/** Settings: the paired customer displays. Removing one cuts it off; it shows a new code. */
export function DisplaysSection() {
  const { t } = useTranslation()
  const displays = useDisplaysQuery()
  const remove = useRemoveDisplay()

  return (
    <section className="rounded-3xl bg-card p-6 shadow-(--shadow-soft)">
      <h2 className="font-heading text-lg font-semibold">
        {t("display.settingsTitle")}
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        {t("display.settingsBody")}
      </p>
      {displays.isPending ? (
        <Skeleton className="h-16 rounded-2xl" />
      ) : displays.isError ? (
        <p className="text-sm text-danger-ink">
          {apiErrorMessage(displays.error)}
        </p>
      ) : displays.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("display.settingsEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {displays.data.map((display) => (
            <li
              key={display.id}
              className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3"
            >
              <MonitorIcon className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{display.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {display.paired_by_name &&
                    t("display.pairedBy", { name: display.paired_by_name })}
                  {display.last_seen &&
                    ` · ${t("display.lastSeen", { when: when.format(new Date(display.last_seen)) })}`}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={async () => {
                  try {
                    await remove.mutateAsync(display.id)
                    toast.success(t("display.removed"))
                  } catch (error) {
                    toast.error(apiErrorMessage(error))
                  }
                }}
              >
                <Trash2Icon />
                {t("display.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
