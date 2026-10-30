import type { User } from "@/features/auth/schemas/auth.ts"

/** POS actions (backend: accounts.PosAccess). Keep in step with docs/permissions.md. */
export const perm = {
  takeOrder: "accounts.take_order",
  voidSentItem: "accounts.void_sent_item",
  applyDiscount: "accounts.apply_discount",
  approveOverride: "accounts.approve_override",
  reprint: "accounts.reprint",
  takePayment: "accounts.take_payment",
  openDrawer: "accounts.open_drawer",
  openShift: "accounts.open_shift",
  closeShift: "accounts.close_shift",
  editFloor: "accounts.edit_floor",
  manageStock: "accounts.manage_stock",
  viewDashboard: "accounts.view_dashboard",
  viewReports: "accounts.view_reports",
  manageStaff: "accounts.manage_staff",
  manageSettings: "accounts.manage_settings",
  viewAudit: "accounts.view_audit",
  printStation: "accounts.print_station",
} as const

export type Permission = (typeof perm)[keyof typeof perm]

/** Checks one permission. Never checks role codes: an owner can give any action to any role. */
export function hasPermission(
  user: User | null | undefined,
  permission: string
) {
  if (!user) return false
  if (user.is_superuser) return true
  return user.permissions.includes("*") || user.permissions.includes(permission)
}

export function hasAnyPermission(
  user: User | null | undefined,
  permissions: readonly string[]
) {
  return permissions.some((permission) => hasPermission(user, permission))
}
