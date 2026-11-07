import { CloudOffIcon, CloudUploadIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { StatusPill } from "@/components/pos/status-pill.tsx"
import { pendingSales, useOutbox } from "@/features/snackbar/store/outbox.ts"
import { useConnectivity } from "@/lib/connectivity.ts"

/**
 * In the top bar while the server can't be reached, and while counter
 * sales made offline are still waiting to be sent.
 */
export function OfflineBadge() {
  const { t } = useTranslation()
  const online = useConnectivity((state) => state.online)
  const waiting = useOutbox((state) => pendingSales(state.sales).length)
  if (online && waiting === 0) return null
  return (
    <StatusPill tone="warning">
      {online ? (
        <CloudUploadIcon className="size-3.5" />
      ) : (
        <CloudOffIcon className="size-3.5" />
      )}
      <span className="whitespace-nowrap">
        {online ? t("offline.sending") : t("offline.badge")}
        {waiting > 0 && ` · ${waiting}`}
      </span>
    </StatusPill>
  )
}

/** Under the top bar on the restaurant screens, which need the server. */
export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useConnectivity((state) => state.online)
  if (online) return null
  return (
    <p
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-center text-sm font-medium text-warning-ink"
    >
      <CloudOffIcon className="size-4 shrink-0" />
      {t("offline.banner")}
    </p>
  )
}
