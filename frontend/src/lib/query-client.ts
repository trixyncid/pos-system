import { MutationCache, QueryClient } from "@tanstack/react-query"
import axios from "axios"
import { toast } from "sonner"

import { apiErrorMessage } from "@/lib/api-error.ts"

export const queryClient: QueryClient = new QueryClient({
  // A failed save on a busy floor must never pass silently. A mutation that
  // shows its own error sets `meta: { silent: true }`.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silent) return
      toast.error(apiErrorMessage(error))
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status ?? 0
          if (status >= 400 && status < 500) return false
        }
        return failureCount < 2
      },
    },
  },
})

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}
