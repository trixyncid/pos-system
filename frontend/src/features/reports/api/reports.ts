import { keepPreviousData, useQuery } from "@tanstack/react-query"

import {
  dashboardSchema,
  itemsReportSchema,
  salesReportSchema,
} from "@/features/reports/schemas/reports.ts"
import { api } from "@/lib/api.ts"

export type Range = { from: string; to: string }

export const reportKeys = {
  all: ["reports"] as const,
  dashboard: (date: string) => [...reportKeys.all, "dashboard", date] as const,
  sales: (range: Range) => [...reportKeys.all, "sales", range] as const,
  items: (range: Range) => [...reportKeys.all, "items", range] as const,
}

export function useDashboardQuery(date: string) {
  return useQuery({
    queryKey: reportKeys.dashboard(date),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/reports/dashboard/", {
        params: { date },
        signal,
      })
      return dashboardSchema.parse(data.data)
    },
    placeholderData: keepPreviousData,
    // Today's figures move with every sale; a minute is fresh enough for an owner.
    refetchInterval: 60_000,
  })
}

export function useSalesReportQuery(range: Range) {
  return useQuery({
    queryKey: reportKeys.sales(range),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/reports/sales/", {
        params: range,
        signal,
      })
      return salesReportSchema.parse(data.data)
    },
    placeholderData: keepPreviousData,
  })
}

export function useItemsReportQuery(range: Range, enabled: boolean) {
  return useQuery({
    queryKey: reportKeys.items(range),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/reports/items/", {
        params: range,
        signal,
      })
      return itemsReportSchema.parse(data.data)
    },
    placeholderData: keepPreviousData,
    enabled,
  })
}
