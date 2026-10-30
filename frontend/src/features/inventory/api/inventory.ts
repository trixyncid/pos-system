import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

import {
  movementPageSchema,
  movementSchema,
  stockPageSchema,
  stockSummarySchema,
  type MovementKind,
} from "@/features/inventory/schemas/inventory.ts"
import { api } from "@/lib/api.ts"
import { idempotencyHeaders } from "@/lib/idempotency.ts"

export type StockParams = {
  search?: string
  kind?: "ingredient" | "retail"
  status?: "low" | "out"
  page?: number
}

export type MovementParams = {
  product?: string
  kind?: MovementKind
  page?: number
}

export const inventoryKeys = {
  all: ["inventory"] as const,
  stock: (params: StockParams) =>
    [...inventoryKeys.all, "stock", params] as const,
  allStock: () => [...inventoryKeys.all, "stock", "all"] as const,
  summary: () => [...inventoryKeys.all, "summary"] as const,
  movements: (params: MovementParams) =>
    [...inventoryKeys.all, "movements", params] as const,
}

export function useStockQuery(params: StockParams) {
  return useQuery({
    queryKey: inventoryKeys.stock(params),
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/inventory/stock/", {
        params: { ...params, page_size: 50 },
        signal,
      })
      return stockPageSchema.parse(data)
    },
    placeholderData: keepPreviousData,
  })
}

/** Every tracked item at once, for picking lines in a delivery or a count. */
export function useAllStockQuery(enabled: boolean) {
  return useQuery({
    queryKey: inventoryKeys.allStock(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/inventory/stock/", {
        params: { page_size: 100 },
        signal,
      })
      return stockPageSchema.parse(data).results
    },
    enabled,
  })
}

export function useStockSummaryQuery() {
  return useQuery({
    queryKey: inventoryKeys.summary(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>(
        "/inventory/stock/summary/",
        { signal }
      )
      return stockSummarySchema.parse(data.data)
    },
  })
}

export function useMovementsQuery(params: MovementParams) {
  return useQuery({
    queryKey: inventoryKeys.movements(params),
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/inventory/movements/", {
        params: { ...params, page_size: 30 },
        signal,
      })
      return movementPageSchema.parse(data)
    },
    placeholderData: keepPreviousData,
  })
}

function useStockMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
    meta: { silent: true },
  })
}

export type ReceiveBody = {
  id: string
  supplier: string
  note: string
  lines: { product: string; quantity: number; unit_cost: number }[]
}

export function useReceive() {
  return useStockMutation(async (body: ReceiveBody) => {
    const { data } = await api.post<{ data: unknown }>(
      "/inventory/movements/receive/",
      body,
      { headers: idempotencyHeaders(body.id) }
    )
    return z.array(movementSchema).parse(data.data)
  })
}

export function useWaste() {
  return useStockMutation(
    async (body: { product: string; quantity: number; reason: string }) => {
      const { data } = await api.post<{ data: unknown }>(
        "/inventory/movements/waste/",
        body
      )
      return movementSchema.parse(data.data)
    }
  )
}

export type CountBody = {
  id: string
  note: string
  lines: { product: string; counted: number }[]
}

export function useCount() {
  return useStockMutation(async (body: CountBody) => {
    const { data } = await api.post<{ data: unknown }>(
      "/inventory/movements/count/",
      body,
      { headers: idempotencyHeaders(body.id) }
    )
    return z.array(movementSchema).parse(data.data)
  })
}
