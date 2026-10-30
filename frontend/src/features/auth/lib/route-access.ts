import {
  pageForPath,
  pages,
  type Shell,
} from "@/features/auth/lib/page-catalog.ts"
import { hasAnyPermission } from "@/features/auth/lib/permissions.ts"
import type { User } from "@/features/auth/schemas/auth.ts"

export function canOpenPage(
  user: User | null | undefined,
  page: { anyOf: readonly string[] }
) {
  return hasAnyPermission(user, page.anyOf)
}

/** Paths outside the catalog (the forbidden page, redirects) are open to any signed-in user. */
export function canAccessPath(user: User | null | undefined, pathname: string) {
  const page = pageForPath(pathname)
  return page ? canOpenPage(user, page) : Boolean(user)
}

export function visiblePages(user: User | null | undefined, shell?: Shell) {
  return pages.filter(
    (page) =>
      !page.hidden &&
      (!shell || page.shell === shell) &&
      canOpenPage(user, page)
  )
}

/** Where a user lands after sign-in: their first POS screen, else their first back-office screen. */
export function homePath(user: User | null | undefined) {
  return (
    visiblePages(user, "pos")[0]?.path ??
    visiblePages(user, "admin")[0]?.path ??
    "/forbidden"
  )
}
