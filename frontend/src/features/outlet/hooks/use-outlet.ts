import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getOutlet,
  outletKeys,
  updateOutlet,
} from "@/features/outlet/api/outlet.ts"

export function useOutletQuery() {
  return useQuery({
    queryKey: outletKeys.detail(),
    queryFn: ({ signal }) => getOutlet(signal),
    // Outlet settings change rarely; the settings page invalidates on save.
    staleTime: 60 * 60 * 1000,
  })
}

export function useUpdateOutlet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateOutlet,
    onSuccess: (outlet) =>
      queryClient.setQueryData(outletKeys.detail(), outlet),
    meta: { silent: true },
  })
}
