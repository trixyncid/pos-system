import {
  hasAnyPermission,
  hasPermission,
} from "@/features/auth/lib/permissions.ts"
import { useSession } from "@/features/auth/store/session-store.ts"

export function useCan(permission: string) {
  return useSession((state) => hasPermission(state.user, permission))
}

export function useCanAny(permissions: readonly string[]) {
  return useSession((state) => hasAnyPermission(state.user, permissions))
}
