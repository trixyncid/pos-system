import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { useOrderMutation } from "@/features/ordering/api/orders.ts"
import { orderSchema } from "@/features/ordering/schemas/order.ts"
import {
  offeredPromoSchema,
  promoSchema,
  type PromoForm,
} from "@/features/promos/schemas/promo.ts"
import { api } from "@/lib/api.ts"

export const promoKeys = {
  all: ["promos"] as const,
  list: () => [...promoKeys.all, "list"] as const,
  offered: (orderId: string) => [...promoKeys.all, "offered", orderId] as const,
}

export function usePromosQuery() {
  return useQuery({
    queryKey: promoKeys.list(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/promos/", { signal })
      return z.array(promoSchema).parse(data.data)
    },
  })
}

export function useSavePromo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: PromoForm }) => {
      const { data } = id
        ? await api.patch<{ data: unknown }>(`/promos/${id}/`, form)
        : await api.post<{ data: unknown }>("/promos/", form)
      return promoSchema.parse(data.data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: promoKeys.all }),
    meta: { silent: true },
  })
}

export function useSetPromoActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string
      is_active: boolean
    }) => {
      const { data } = await api.patch<{ data: unknown }>(`/promos/${id}/`, {
        is_active,
      })
      return promoSchema.parse(data.data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: promoKeys.all }),
  })
}

export function useUploadPromoImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const body = new FormData()
      body.append("image", file)
      const { data } = await api.post<{ data: unknown }>(
        `/promos/${id}/image/`,
        body,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return promoSchema.parse(data.data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: promoKeys.all }),
    meta: { silent: true },
  })
}

/** The promos the cashier can offer on this bill now, best saving first. */
export function useOfferedPromosQuery(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: promoKeys.offered(orderId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>(
        `/orders/${orderId}/promos/`,
        { signal }
      )
      return z.array(offeredPromoSchema).parse(data.data)
    },
    enabled,
    staleTime: 0,
  })
}

export function useApplyPromo() {
  return useOrderMutation(
    async ({ orderId, promo }: { orderId: string; promo: string | null }) =>
      orderSchema.parse(
        (
          await api.post<{ data: unknown }>(`/orders/${orderId}/promo/`, {
            promo,
          })
        ).data.data
      ),
    true,
    [promoKeys.all]
  )
}
