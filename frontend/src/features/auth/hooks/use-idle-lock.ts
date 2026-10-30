import { useEffect } from "react"

import { useSession } from "@/features/auth/store/session-store.ts"

const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const

/**
 * Locks a shared tablet after `minutes` without a touch, so the next person
 * cannot act as whoever walked away. The owner sets `minutes` in Settings.
 */
export function useIdleLock(minutes = 3) {
  const status = useSession((state) => state.status)
  const lock = useSession((state) => state.lock)

  useEffect(() => {
    if (status !== "active") return
    let timer = window.setTimeout(lock, minutes * 60_000)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(lock, minutes * 60_000)
    }
    for (const name of events)
      window.addEventListener(name, reset, { passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const name of events) window.removeEventListener(name, reset)
    }
  }, [status, lock, minutes])
}
