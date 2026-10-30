import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { auditPageSchema } from "@/features/audit/schemas/audit.ts"
import { api } from "@/lib/api.ts"

export type AuditParams = {
  action?: string
  search?: string
  date?: string
  page?: number
}

export function useAuditQuery(params: AuditParams) {
  return useQuery({
    queryKey: ["audit", params],
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/audit/events/", {
        params: { ...params, page_size: 30 },
        signal,
      })
      return auditPageSchema.parse(data)
    },
    placeholderData: keepPreviousData,
  })
}
