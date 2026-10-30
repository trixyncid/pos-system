import { pages } from "@/features/auth/lib/page-catalog.ts"
import { perm, type Permission } from "@/features/auth/lib/permissions.ts"

/** How the role editor and matrix group the POS actions. Every catalog permission appears once. */
export const permissionGroups: readonly {
  key: "service" | "cash" | "backOffice" | "device"
  permissions: readonly Permission[]
}[] = [
  {
    key: "service",
    permissions: [
      perm.takeOrder,
      perm.voidSentItem,
      perm.applyDiscount,
      perm.approveOverride,
      perm.reprint,
      perm.takePayment,
    ],
  },
  {
    key: "cash",
    permissions: [perm.openShift, perm.closeShift, perm.openDrawer],
  },
  {
    key: "backOffice",
    permissions: [
      perm.viewDashboard,
      perm.viewReports,
      perm.manageSettings,
      perm.editFloor,
      perm.manageStock,
      perm.manageStaff,
      perm.viewAudit,
    ],
  },
  { key: "device", permissions: [perm.printStation] },
]

/** "accounts.take_order" -> "take_order", the key of its label in locales/*.ts. */
export function shortName(permission: string) {
  return permission.split(".").at(-1) ?? permission
}

/** The catalog pages a permission opens, for "Opens: Floor, Snack bar" hints. */
export function pagesOpenedBy(permission: string) {
  return pages.filter((page) => page.anyOf.includes(permission))
}
