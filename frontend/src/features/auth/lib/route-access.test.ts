import { perm } from "@/features/auth/lib/permissions.ts"
import {
  canAccessPath,
  homePath,
  visiblePages,
} from "@/features/auth/lib/route-access.ts"
import type { User } from "@/features/auth/schemas/auth.ts"

function user(permissions: string[], overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: "x@example.com",
    full_name: "X",
    has_pin: true,
    is_superuser: false,
    roles: [],
    permissions,
    ...overrides,
  }
}

describe("route access", () => {
  it("opens a page only with one of its permissions", () => {
    const waiter = user([perm.takeOrder])
    expect(canAccessPath(waiter, "/floor")).toBe(true)
    expect(canAccessPath(waiter, "/admin/staff")).toBe(false)
    expect(canAccessPath(waiter, "/snackbar")).toBe(false)
  })

  it("matches nested paths to their catalog page", () => {
    const stock = user([perm.manageStock])
    expect(canAccessPath(stock, "/admin/inventory/receive")).toBe(true)
    expect(canAccessPath(stock, "/admin/inventoryx")).toBe(true) // not a catalog page: any signed-in user
  })

  it("sends each role to its own start screen", () => {
    expect(homePath(user([perm.takeOrder]))).toBe("/floor")
    expect(homePath(user([perm.manageStock]))).toBe("/admin/inventory")
    expect(homePath(user([perm.printStation]))).toBe("/print-station")
    expect(homePath(user([]))).toBe("/forbidden")
  })

  it("treats * and superusers as every permission", () => {
    expect(visiblePages(user(["*"]))).toHaveLength(
      visiblePages(user([], { is_superuser: true })).length
    )
    expect(canAccessPath(user(["*"]), "/admin/audit")).toBe(true)
  })
})
