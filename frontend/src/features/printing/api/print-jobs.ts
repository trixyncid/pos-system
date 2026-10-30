import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { printJobSchema } from "@/features/printing/schemas/print-job.ts"
import { api } from "@/lib/api.ts"

export const printKeys = {
  all: ["print-jobs"] as const,
  list: (stations: string[]) => [...printKeys.all, stations] as const,
}

/**
 * Recent jobs for the stations this tablet prints for. Realtime events
 * refresh it at once; the interval is a safety net for a dropped socket.
 */
export function usePrintJobsQuery(stations: string[]) {
  return useQuery({
    queryKey: printKeys.list(stations),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/printing/jobs/", {
        params: { station: stations.join(",") },
        signal,
      })
      return z.array(printJobSchema).parse(data.data)
    },
    refetchInterval: 10_000,
  })
}

function usePrintMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: printKeys.all }),
  })
}

export function useAckJob() {
  return usePrintMutation(
    ({
      id,
      status,
      error = "",
    }: {
      id: string
      status: "printed" | "failed"
      error?: string
    }) => api.post(`/printing/jobs/${id}/ack/`, { status, error })
  )
}

export function useReprint() {
  return usePrintMutation((id: string) =>
    api.post(`/printing/jobs/${id}/reprint/`)
  )
}

export function useTestPrint() {
  return usePrintMutation((station: string) =>
    api.post("/printing/jobs/test/", { station })
  )
}
