import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import type { PayMethod } from "@/features/checkout/api/checkout.ts"
import { orderSchema } from "@/features/ordering/schemas/order.ts"
import { shiftKeys } from "@/features/shifts/api/shifts.ts"
import { api } from "@/lib/api.ts"
import { idempotencyHeaders } from "@/lib/idempotency.ts"

export const saleKeys = {
  all: ["sales"] as const,
  today: () => [...saleKeys.all, "today"] as const,
}

/** Today's counter sales, newest first. */
export function useTodaySalesQuery() {
  return useQuery({
    queryKey: saleKeys.today(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/sales/", { signal })
      return z.array(orderSchema).parse(data.data)
    },
  })
}

export type SaleBody = {
  id: string
  method: PayMethod
  tendered: number
  lines: { id: string; product: string; quantity: number }[]
}

/** One request: the order, the payment and the receipt. Retrying with the same id never sells twice. */
export function useSell() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: SaleBody) => {
      const { data } = await api.post<{ data: unknown }>("/sales/", body, {
        headers: idempotencyHeaders(body.id),
      })
      return orderSchema.parse(data.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
      void queryClient.invalidateQueries({ queryKey: shiftKeys.all })
    },
    meta: { silent: true },
  })
}
