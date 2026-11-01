import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { create } from "zustand"

import {
  MOCK_CHANNEL,
  type DisplayState,
  type MockMessage,
} from "@/features/display/lib/state.ts"
import { api } from "@/lib/api.ts"
import { apiErrorCode } from "@/lib/api-error.ts"
import { env } from "@/lib/env.ts"

export const displaySchema = z.object({
  id: z.string(),
  name: z.string(),
  paired_at: z.string().nullable(),
  paired_by_name: z.string().nullable(),
  last_seen: z.string().nullable(),
  created_at: z.string(),
})
export type CustomerDisplay = z.infer<typeof displaySchema>

export const displayKeys = { all: ["displays"] as const }

/**
 * Which display this cashier screen feeds. It belongs to the device (the
 * cashier PC), not to whoever is signed in, so it lives in this browser.
 */
const storageKey = "pos.display.paired"
type Paired = { id: string; name: string }

function stored(): Paired | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as Paired) : null
  } catch {
    return null
  }
}

export const usePairedDisplay = create<{
  paired: Paired | null
  set: (paired: Paired | null) => void
}>()((set) => ({
  paired: stored(),
  set: (paired) => {
    try {
      if (paired)
        window.localStorage.setItem(storageKey, JSON.stringify(paired))
      else window.localStorage.removeItem(storageKey)
    } catch {
      // Private mode: paired until this page reloads.
    }
    set({ paired })
  },
}))

let mockChannel: BroadcastChannel | null = null
function mock(message: MockMessage) {
  mockChannel ??= new BroadcastChannel(MOCK_CHANNEL)
  mockChannel.postMessage(message)
}

export function usePairDisplay() {
  const setPaired = usePairedDisplay((state) => state.set)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      if (env.useMocks) {
        mock({ type: "paired", code })
        return { id: "mock-display", name: "Layar pelanggan" }
      }
      const { data } = await api.post<{ data: unknown }>("/displays/pair/", {
        code,
      })
      return displaySchema.parse(data.data)
    },
    onSuccess: (display) => {
      setPaired({ id: display.id, name: display.name })
      void queryClient.invalidateQueries({ queryKey: displayKeys.all })
    },
  })
}

/** Send the display what to show. Failures are quiet: the sale never waits on the screen. */
export async function pushDisplayState(id: string, state: DisplayState) {
  if (env.useMocks) {
    mock({ type: "state", state })
    return
  }
  try {
    await api.post(`/displays/${id}/state/`, { state })
  } catch (error) {
    // Removed in Settings: stop sending until it is paired again.
    if (apiErrorCode(error) === "display_unpaired")
      usePairedDisplay.getState().set(null)
  }
}

export function useDisplaysQuery() {
  return useQuery({
    queryKey: displayKeys.all,
    queryFn: async () => {
      const { data } = await api.get<{ data: unknown }>("/displays/")
      return z.array(displaySchema).parse(data.data)
    },
  })
}

export function useRemoveDisplay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/displays/${id}/`)
      if (env.useMocks) mock({ type: "revoked" })
      if (usePairedDisplay.getState().paired?.id === id)
        usePairedDisplay.getState().set(null)
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: displayKeys.all }),
  })
}
