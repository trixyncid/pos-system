import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { shiftSchema, type Shift } from "@/features/shifts/schemas/shift.ts"
import { api } from "@/lib/api.ts"

export const shiftKeys = {
  all: ["shifts"] as const,
  current: () => [...shiftKeys.all, "current"] as const,
  history: () => [...shiftKeys.all, "history"] as const,
}

/** The open shift, or null when the drawer is closed. */
export function useCurrentShiftQuery(enabled = true) {
  return useQuery({
    queryKey: shiftKeys.current(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/shifts/current/", {
        signal,
      })
      return shiftSchema.nullable().parse(data.data)
    },
    enabled,
  })
}

export function useShiftHistoryQuery() {
  return useQuery({
    queryKey: shiftKeys.history(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/shifts/", { signal })
      return z.array(shiftSchema).parse(data.data)
    },
  })
}

function useShiftMutation<TVars>(fn: (vars: TVars) => Promise<Shift>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (shift) => {
      queryClient.setQueryData(
        shiftKeys.current(),
        shift.closed_at ? null : shift
      )
      void queryClient.invalidateQueries({ queryKey: shiftKeys.history() })
    },
    meta: { silent: true },
  })
}

const parse = (data: { data: unknown }) => shiftSchema.parse(data.data)

export function useOpenShift() {
  return useShiftMutation(async (openingCash: number) =>
    parse((await api.post("/shifts/", { opening_cash: openingCash })).data)
  )
}

export function useMoveCash() {
  return useShiftMutation(
    async ({
      shiftId,
      ...body
    }: {
      shiftId: string
      kind: "in" | "out"
      amount: number
      reason: string
    }) => parse((await api.post(`/shifts/${shiftId}/movements/`, body)).data)
  )
}

export function useCloseShift() {
  return useShiftMutation(
    async ({
      shiftId,
      ...body
    }: {
      shiftId: string
      counted_cash: number
      note: string
    }) => parse((await api.post(`/shifts/${shiftId}/close/`, body)).data)
  )
}
