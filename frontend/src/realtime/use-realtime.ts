import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { hasPermission, perm } from "@/features/auth/lib/permissions.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { floorKeys } from "@/features/floor/api/floor.ts"
import { orderKeys } from "@/features/ordering/api/orders.ts"
import { printKeys } from "@/features/printing/api/print-jobs.ts"
import { env } from "@/lib/env.ts"
import { bus, type Stream } from "@/realtime/bus.ts"
import { connect, type ConnectionState } from "@/realtime/socket.ts"

/**
 * Keeps this tablet in step with the others: opens the socket (outside mock
 * mode) and turns outlet events into query refreshes.
 */
export function useRealtime() {
  const queryClient = useQueryClient()
  const user = useSession((state) => state.user)
  const active = useSession((state) => state.status === "active")
  const [state, setState] = useState<ConnectionState>(
    env.useMocks ? "open" : "closed"
  )

  const streams: Stream[] = []
  if (hasPermission(user, perm.takeOrder)) streams.push("floor", "orders")
  if (hasPermission(user, perm.printStation)) streams.push("print")
  const key = streams.join(",")

  useEffect(() => {
    if (!active || env.useMocks || !key) return
    return connect(key.split(",") as Stream[], setState)
  }, [active, key])

  useEffect(() => {
    const offs = [
      bus.on(
        "floor",
        () => void queryClient.invalidateQueries({ queryKey: floorKeys.all })
      ),
      bus.on("orders", (event) => {
        void queryClient.invalidateQueries({ queryKey: orderKeys.all })
        if (typeof event.id === "string")
          void queryClient.invalidateQueries({
            queryKey: orderKeys.detail(event.id),
          })
      }),
      bus.on(
        "print",
        () => void queryClient.invalidateQueries({ queryKey: printKeys.all })
      ),
    ]
    return () => offs.forEach((off) => off())
  }, [queryClient])

  return state
}
