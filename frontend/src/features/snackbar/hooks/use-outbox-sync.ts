import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { shiftKeys } from "@/features/shifts/api/shifts.ts"
import { saleKeys, sendSale } from "@/features/snackbar/api/sales.ts"
import { pendingSales, useOutbox } from "@/features/snackbar/store/outbox.ts"
import { isSessionEnded } from "@/lib/api.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { isOfflineError, useConnectivity } from "@/lib/connectivity.ts"

/** After a server error (not a refusal), try the queue again this much later. */
const RETRY_MS = 30_000

/**
 * Sends the counter sales made offline, oldest first, as soon as the server
 * answers and someone who can take payments is signed in. A sale the server
 * refuses (no open shift, too old) stays on the list with the reason; the
 * rest carry on. Mounted once for every signed-in screen.
 */
export function useOutboxSync() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const online = useConnectivity((state) => state.online)
  const active = useSession((state) => state.status === "active")
  const canSell = useCan(perm.takePayment)
  const waiting = useOutbox((state) => pendingSales(state.sales).length)
  const running = useRef(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!online || !active || !canSell || waiting === 0 || running.current)
      return
    running.current = true
    let stopped: "offline" | "later" | null = null
    let sent = 0
    void (async () => {
      for (const sale of pendingSales(useOutbox.getState().sales)) {
        try {
          await sendSale(sale.body)
          useOutbox.getState().remove(sale.body.id)
          sent += 1
        } catch (error) {
          if (isOfflineError(error) || isSessionEnded(error)) {
            stopped = "offline"
            break
          }
          const status = (error as { response?: { status: number } }).response
            ?.status
          if (status !== undefined && status >= 400 && status < 500) {
            useOutbox.getState().fail(sale.body.id, apiErrorMessage(error))
            continue
          }
          stopped = "later"
          break
        }
      }
    })().finally(() => {
      running.current = false
      if (sent > 0) {
        toast.success(t("offline.synced", { count: sent }))
        void queryClient.invalidateQueries({ queryKey: saleKeys.all })
        void queryClient.invalidateQueries({ queryKey: shiftKeys.all })
      }
      if (stopped === "later")
        window.setTimeout(() => setTick((value) => value + 1), RETRY_MS)
      // A sale queued while this run was sending goes out straight after.
      else if (!stopped && pendingSales(useOutbox.getState().sales).length)
        setTick((value) => value + 1)
    })
  }, [online, active, canSell, waiting, tick, queryClient, t])
}
