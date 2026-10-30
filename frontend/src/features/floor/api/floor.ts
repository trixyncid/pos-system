import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  areaSchema,
  tableSchema,
  type TableLayout,
} from "@/features/floor/schemas/floor.ts"
import { api } from "@/lib/api.ts"

export const floorKeys = {
  all: ["floor"] as const,
  areas: (all = false) => [...floorKeys.all, "areas", { all }] as const,
}

/**
 * The live floor. "floor" events from other tablets refetch it at once
 * (realtime/use-realtime.ts); the slow interval only covers a dropped socket.
 */
export function useAreasQuery({ includeInactive = false, live = false } = {}) {
  return useQuery({
    queryKey: floorKeys.areas(includeInactive),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/floor/areas/", {
        params: includeInactive ? { all: "true" } : undefined,
        signal,
      })
      return z.array(areaSchema).parse(data.data)
    },
    refetchInterval: live ? 60_000 : false,
  })
}

function useFloorMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: floorKeys.all }),
    meta: { silent: true },
  })
}

export function useSaveArea() {
  return useFloorMutation(
    async ({
      id,
      name,
      is_active,
    }: {
      id?: string
      name: string
      is_active?: boolean
    }) => {
      const body = { name, ...(is_active === undefined ? {} : { is_active }) }
      const { data } = id
        ? await api.patch<{ data: unknown }>(`/floor/areas/${id}/`, body)
        : await api.post<{ data: unknown }>("/floor/areas/", body)
      return areaSchema.parse(data.data)
    }
  )
}

export function useDeleteArea() {
  return useFloorMutation((id: string) => api.delete(`/floor/areas/${id}/`))
}

export function useSaveLayout() {
  return useFloorMutation(
    async ({ areaId, tables }: { areaId: string; tables: TableLayout[] }) => {
      const { data } = await api.put<{ data: unknown }>(
        `/floor/areas/${areaId}/layout/`,
        { tables }
      )
      return areaSchema.parse(data.data)
    }
  )
}

export function useCleanTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ data: unknown }>(
        `/floor/tables/${id}/clean/`
      )
      return tableSchema.parse(data.data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: floorKeys.all }),
  })
}
