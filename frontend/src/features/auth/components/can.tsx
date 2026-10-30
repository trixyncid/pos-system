import type { ReactNode } from "react"

import { useCanAny } from "@/features/auth/hooks/use-can.ts"

/** Renders `children` only when the current user holds `permission` (or any of `anyOf`). */
export function Can({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: string
  anyOf?: readonly string[]
  fallback?: ReactNode
  children: ReactNode
}) {
  const allowed = useCanAny(anyOf ?? (permission ? [permission] : []))
  return <>{allowed ? children : fallback}</>
}
