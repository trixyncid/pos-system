import { perm } from "@/features/auth/lib/permissions.ts"
import type { User } from "@/features/auth/schemas/auth.ts"

/** Mirrors backend/accounts/roles.py so the mock behaves like the seeded API. */
const rolePermissions: Record<string, readonly string[]> = {
  owner: ["*"],
  manager: [
    perm.takeOrder,
    perm.voidSentItem,
    perm.applyDiscount,
    perm.approveOverride,
    perm.reprint,
    perm.takePayment,
    perm.openDrawer,
    perm.openShift,
    perm.closeShift,
    perm.editFloor,
    perm.manageStock,
    perm.viewDashboard,
    perm.viewReports,
    perm.viewAudit,
  ],
  cashier: [
    perm.takeOrder,
    perm.takePayment,
    perm.reprint,
    perm.openShift,
    perm.closeShift,
  ],
  waiter: [perm.takeOrder],
  "print-station": [perm.printStation, perm.reprint],
  inventory: [perm.manageStock],
}

const roleNames: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Kasir",
  waiter: "Pelayan",
  "print-station": "Print Station",
  inventory: "Gudang",
}

export type MockStaff = {
  id: number
  email: string
  full_name: string
  role: keyof typeof rolePermissions
  /** Mock fixtures only: the real API stores passwords and PINs hashed. */
  password: string
  pin: string | null
}

/** Demo accounts. Owner and manager can sign a tablet in; everyone with a PIN can unlock it. */
export const staff: MockStaff[] = [
  {
    id: 1,
    email: "owner@warungsenja.test",
    full_name: "Rina Wijaya",
    role: "owner",
    password: "demo1234",
    pin: "1111",
  },
  {
    id: 2,
    email: "manager@warungsenja.test",
    full_name: "Dimas Pratama",
    role: "manager",
    password: "demo1234",
    pin: "2222",
  },
  {
    id: 3,
    email: "budi@warungsenja.test",
    full_name: "Budi Santoso",
    role: "cashier",
    password: "demo1234",
    pin: "3333",
  },
  {
    id: 4,
    email: "sari@warungsenja.test",
    full_name: "Sari Lestari",
    role: "waiter",
    password: "demo1234",
    pin: "4444",
  },
  {
    id: 5,
    email: "agus@warungsenja.test",
    full_name: "Agus Setiawan",
    role: "waiter",
    password: "demo1234",
    pin: "5555",
  },
  {
    id: 6,
    email: "wati@warungsenja.test",
    full_name: "Wati Rahayu",
    role: "inventory",
    password: "demo1234",
    pin: "6666",
  },
  {
    id: 7,
    email: "printer@warungsenja.test",
    full_name: "Print Station Dapur",
    role: "print-station",
    password: "demo1234",
    pin: null,
  },
]

export function toUser(member: MockStaff): User {
  const role = String(member.role)
  return {
    id: member.id,
    email: member.email,
    full_name: member.full_name,
    has_pin: member.pin !== null,
    is_superuser: false,
    roles: [{ id: member.id * 10, code: role, name: roleNames[role] ?? role }],
    permissions: [...(rolePermissions[role] ?? [])],
  }
}

export function roleName(member: MockStaff) {
  return roleNames[String(member.role)] ?? String(member.role)
}
