import { useEffect, useRef } from "react"

import {
  pushDisplayState,
  usePairedDisplay,
} from "@/features/display/api/display.ts"
import { IDLE, type DisplayState } from "@/features/display/lib/state.ts"

const SEND_DELAY_MS = 120

/**
 * Mirror a screen onto the paired customer display. Pass what the customer
 * should see (or null for the idle screen); a burst of changes, like several
 * fast scans, is sent once. Leaving the screen sends the idle view.
 */
export function useCustomerDisplay(state: DisplayState | null) {
  const paired = usePairedDisplay((s) => s.paired)
  const json = JSON.stringify(state ?? IDLE)
  const sent = useRef<string | null>(null)

  useEffect(() => {
    if (!paired || sent.current === json) return
    const timer = window.setTimeout(() => {
      sent.current = json
      void pushDisplayState(paired.id, JSON.parse(json) as DisplayState)
    }, SEND_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [paired, json])

  useEffect(() => {
    if (!paired) return
    return () => {
      sent.current = null
      void pushDisplayState(paired.id, IDLE)
    }
  }, [paired])
}
