import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { useOrderMutation } from "@/features/ordering/api/orders.ts"
import { orderSchema } from "@/features/ordering/schemas/order.ts"
import {
  orderPageSchema,
  type HistoryStatus,
} from "@/features/order-history/schemas/history.ts"
import { shiftKeys } from "@/features/shifts/api/shifts.ts"
import { api } from "@/lib/api.ts"

export type HistoryParams = {
  from: string
  to: string
  channel?: "restaurant" | "snackbar"
  status?: HistoryStatus
  search?: string
  page?: number
}

export const historyKeys = {
  all: ["order-history"] as const,
  list: (params: HistoryParams) => [...historyKeys.all, params] as const,
}

export function useOrderHistoryQuery(params: HistoryParams) {
  return useQuery({
    queryKey: historyKeys.list(params),
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/orders/history/", {
        params: { ...params, page_size: 25 },
        signal,
      })
      return orderPageSchema.parse(data)
    },
    placeholderData: keepPreviousData,
  })
}

/** Refunding moves the drawer and the list too. */
export function useRefundOrder() {
  return useOrderMutation(
    async ({
      orderId,
      ...body
    }: {
      orderId: string
      reason: string
      approver?: number
      approver_pin?: string
    }) =>
      orderSchema.parse(
        (await api.post<{ data: unknown }>(`/orders/${orderId}/refund/`, body))
          .data.data
      ),
    true,
    [historyKeys.all, shiftKeys.all]
  )
}

export function useReprintOrder() {
  return useMutation({
    mutationFn: async ({
      orderId,
      kind,
    }: {
      orderId: string
      kind: "bill" | "receipt"
    }) => {
      await api.post(`/orders/${orderId}/reprint/`, { kind })
    },
  })
}

/** After a cancel or any change made from the detail, the list refetches. */
export function useInvalidateHistory() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: historyKeys.all })
}
