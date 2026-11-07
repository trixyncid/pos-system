import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import {
  useCategoriesQuery,
  useProductsQuery,
} from "@/features/catalog/api/catalog.ts"
import { useOutletQuery } from "@/features/outlet/hooks/use-outlet.ts"
import { useCurrentShiftQuery } from "@/features/shifts/api/shifts.ts"

function Load() {
  useProductsQuery("retail")
  useProductsQuery("menu")
  useCategoriesQuery()
  useOutletQuery()
  useCurrentShiftQuery()
  return null
}

/**
 * Loads what the snack bar sells from, whichever screen the cashier is on,
 * so the saved offline copy (lib/offline-cache.ts) is ready before the
 * internet goes, not only after someone opened the snack bar.
 */
export function OfflineReady() {
  const canSell = useCan(perm.takePayment)
  return canSell ? <Load /> : null
}
