import { useQuery } from "@tanstack/react-query"

import { getOutlet, outletKeys } from "@/features/outlet/api/outlet.ts"

export function useOutletQuery() {
  return useQuery({
    queryKey: outletKeys.detail(),
    queryFn: ({ signal }) => getOutlet(signal),
    // Outlet settings change rarely; the settings page invalidates on save.
    staleTime: 60 * 60 * 1000,
  })
}
