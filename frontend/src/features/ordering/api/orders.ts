import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { floorKeys } from "@/features/floor/api/floor.ts"
import {
  approverSchema,
  orderSchema,
  type DraftLine,
  type Order,
} from "@/features/ordering/schemas/order.ts"
import { api } from "@/lib/api.ts"
import { idempotencyHeaders } from "@/lib/idempotency.ts"

export const orderKeys = {
  all: ["orders"] as const,
  open: () => [...orderKeys.all, "open"] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
  approvers: () => [...orderKeys.all, "approvers"] as const,
}

const parse = (data: { data: unknown }) => orderSchema.parse(data.data)

export function useOrderQuery(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: async ({ signal }) =>
      parse((await api.get(`/orders/${id}/`, { signal })).data),
  })
}

/** Orders still holding a table, for merging and moving. */
export function useOpenOrdersQuery(enabled = true) {
  return useQuery({
    queryKey: orderKeys.open(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/orders/", { signal })
      return z.array(orderSchema).parse(data.data)
    },
    enabled,
  })
}

export function useApproversQuery(enabled: boolean) {
  return useQuery({
    queryKey: orderKeys.approvers(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/auth/approvers/", {
        signal,
      })
      return z.array(approverSchema).parse(data.data)
    },
    enabled,
    staleTime: 5 * 60_000,
  })
}

/** Every order change moves the floor too (status, total), so both refresh. */
function useOrderMutation<TVars>(
  fn: (vars: TVars) => Promise<Order>,
  silent = true
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order)
      void queryClient.invalidateQueries({ queryKey: floorKeys.all })
      void queryClient.invalidateQueries({ queryKey: orderKeys.open() })
    },
    meta: { silent },
  })
}

export function useOpenOrder() {
  return useOrderMutation(
    async (body: {
      id: string
      table: string | null
      guests: number
      type?: "dine_in" | "takeaway"
    }) =>
      parse(
        (
          await api.post("/orders/", body, {
            headers: idempotencyHeaders(body.id),
          })
        ).data
      ),
    false
  )
}

export function useAddLines() {
  return useOrderMutation(
    async ({
      orderId,
      lines,
      send,
    }: {
      orderId: string
      lines: DraftLine[]
      send: boolean
    }) =>
      parse(
        (
          await api.post(`/orders/${orderId}/lines/`, {
            send,
            lines: lines.map((line) => ({
              id: line.id,
              product: line.product,
              quantity: line.quantity,
              modifiers: line.modifiers.map((modifier) => modifier.id),
              note: line.note,
              seat: line.seat,
            })),
          })
        ).data
      )
  )
}

export function useSendHeld() {
  return useOrderMutation(
    async ({ orderId, lineIds }: { orderId: string; lineIds?: string[] }) =>
      parse(
        (
          await api.post(`/orders/${orderId}/send/`, {
            line_ids: lineIds ?? null,
          })
        ).data
      )
  )
}

export function useUpdateLine() {
  return useOrderMutation(
    async ({
      orderId,
      lineId,
      ...change
    }: {
      orderId: string
      lineId: string
      quantity?: number
      note?: string
    }) =>
      parse(
        (await api.patch(`/orders/${orderId}/lines/${lineId}/`, change)).data
      ),
    false
  )
}

export function useVoidLine() {
  return useOrderMutation(
    async ({
      orderId,
      lineId,
      ...body
    }: {
      orderId: string
      lineId: string
      reason?: string
      approver?: number
      approver_pin?: string
    }) =>
      parse(
        (await api.post(`/orders/${orderId}/lines/${lineId}/void/`, body)).data
      )
  )
}

export function useMoveOrder() {
  return useOrderMutation(
    async ({ orderId, table }: { orderId: string; table: string }) =>
      parse((await api.post(`/orders/${orderId}/move/`, { table })).data)
  )
}

export function useMergeOrder() {
  return useOrderMutation(
    async ({ orderId, source }: { orderId: string; source: string }) =>
      parse((await api.post(`/orders/${orderId}/merge/`, { source })).data)
  )
}

export function useSetGuests() {
  return useOrderMutation(
    async ({ orderId, guests }: { orderId: string; guests: number }) =>
      parse((await api.post(`/orders/${orderId}/guests/`, { guests })).data),
    false
  )
}

export function useCancelOrder() {
  return useOrderMutation(async (orderId: string) =>
    parse((await api.post(`/orders/${orderId}/cancel/`)).data)
  )
}
