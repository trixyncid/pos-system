import {
  BarChart3Icon,
  BookOpenIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  type LucideIcon,
  PackageIcon,
  PencilRulerIcon,
  PrinterIcon,
  TicketPercentIcon,
  ScanBarcodeIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { perm } from "@/features/auth/lib/permissions.ts"

export type Shell = "pos" | "admin"
export type Section = "service" | "overview" | "catalog" | "people" | "system"

type NavKey =
  | "order"
  | "checkout"
  | "floor"
  | "snackbar"
  | "shifts"
  | "printStation"
  | "dashboard"
  | "reports"
  | "menu"
  | "promos"
  | "floorEditor"
  | "inventory"
  | "staff"
  | "roles"
  | "settings"
  | "audit"

export type Page = {
  key: NavKey
  path: string
  shell: Shell
  section: Section
  icon: LucideIcon
  /** The page opens for anyone holding at least one of these. */
  anyOf: readonly string[]
  /** Milestone that builds the real screen, shown on its placeholder. */
  milestone: string
  /** Reached from another screen (the order screen from a table), never from the nav. */
  hidden?: boolean
}

/**
 * The single list of pages. The sidebars, the route guards and (in M2) the
 * role editor all read it, so a page and its permission are declared once.
 */
export const pages: readonly Page[] = [
  {
    key: "order",
    path: "/order",
    shell: "pos",
    section: "service",
    icon: LayoutGridIcon,
    anyOf: [perm.takeOrder],
    milestone: "M5",
    hidden: true,
  },
  {
    key: "checkout",
    path: "/checkout",
    shell: "pos",
    section: "service",
    icon: WalletIcon,
    anyOf: [perm.takePayment],
    milestone: "M6",
    hidden: true,
  },
  {
    key: "floor",
    path: "/floor",
    shell: "pos",
    section: "service",
    icon: LayoutGridIcon,
    anyOf: [perm.takeOrder],
    milestone: "M4",
  },
  {
    key: "snackbar",
    path: "/snackbar",
    shell: "pos",
    section: "service",
    icon: ScanBarcodeIcon,
    anyOf: [perm.takePayment],
    milestone: "M7",
  },
  {
    key: "shifts",
    path: "/shifts",
    shell: "pos",
    section: "service",
    icon: WalletIcon,
    anyOf: [perm.openShift, perm.closeShift],
    milestone: "M6",
  },
  {
    key: "printStation",
    path: "/print-station",
    shell: "pos",
    section: "service",
    icon: PrinterIcon,
    anyOf: [perm.printStation],
    milestone: "M5",
  },
  {
    key: "dashboard",
    path: "/admin/dashboard",
    shell: "admin",
    section: "overview",
    icon: LayoutDashboardIcon,
    anyOf: [perm.viewDashboard],
    milestone: "M9",
  },
  {
    key: "reports",
    path: "/admin/reports",
    shell: "admin",
    section: "overview",
    icon: BarChart3Icon,
    anyOf: [perm.viewReports],
    milestone: "M9",
  },
  {
    key: "menu",
    path: "/admin/menu",
    shell: "admin",
    section: "catalog",
    icon: BookOpenIcon,
    anyOf: [perm.manageSettings],
    milestone: "M3",
  },
  {
    key: "promos",
    path: "/admin/promos",
    shell: "admin",
    section: "catalog",
    icon: TicketPercentIcon,
    anyOf: [perm.managePromos],
    milestone: "M6",
  },
  {
    key: "floorEditor",
    path: "/admin/floor",
    shell: "admin",
    section: "catalog",
    icon: PencilRulerIcon,
    anyOf: [perm.editFloor],
    milestone: "M4",
  },
  {
    key: "inventory",
    path: "/admin/inventory",
    shell: "admin",
    section: "catalog",
    icon: PackageIcon,
    anyOf: [perm.manageStock],
    milestone: "M8",
  },
  {
    key: "staff",
    path: "/admin/staff",
    shell: "admin",
    section: "people",
    icon: UsersIcon,
    anyOf: [perm.manageStaff],
    milestone: "M2",
  },
  {
    key: "roles",
    path: "/admin/roles",
    shell: "admin",
    section: "people",
    icon: ShieldCheckIcon,
    anyOf: [perm.manageStaff],
    milestone: "M2",
  },
  {
    key: "settings",
    path: "/admin/settings",
    shell: "admin",
    section: "system",
    icon: SettingsIcon,
    anyOf: [perm.manageSettings],
    milestone: "M2",
  },
  {
    key: "audit",
    path: "/admin/audit",
    shell: "admin",
    section: "system",
    icon: ScrollTextIcon,
    anyOf: [perm.viewAudit],
    milestone: "M9",
  },
]

export const sectionOrder: readonly Section[] = [
  "service",
  "overview",
  "catalog",
  "people",
  "system",
]

export function pageByKey(key: NavKey) {
  const page = pages.find((item) => item.key === key)
  if (!page) throw new Error(`Unknown page ${key}`)
  return page
}

/** The catalog page that owns `pathname` (longest matching prefix), if any. */
export function pageForPath(pathname: string) {
  return pages
    .filter(
      (page) => pathname === page.path || pathname.startsWith(`${page.path}/`)
    )
    .sort((a, b) => b.path.length - a.path.length)[0]
}
