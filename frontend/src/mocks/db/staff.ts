import { perm } from "@/features/auth/lib/permissions.ts"
import type { User } from "@/features/auth/schemas/auth.ts"

export type MockRole = {
  id: number
  name: string
  code: string
  description: string
  is_system: boolean
  permissions: string[]
}

/** Mirrors backend/accounts/roles.py so the mock behaves like the seeded API. */
const allPermissions = Object.values(perm)

export const roles: MockRole[] = [
  {
    id: 1,
    name: "Owner",
    code: "owner",
    description: "Semua akses.",
    is_system: true,
    permissions: [...allPermissions],
  },
  {
    id: 2,
    name: "Manager",
    code: "manager",
    description: "Menjalankan layanan harian.",
    is_system: true,
    permissions: [
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
  },
  {
    id: 3,
    name: "Kasir",
    code: "cashier",
    description: "Menerima pembayaran dan mengelola shift kas.",
    is_system: true,
    permissions: [
      perm.takeOrder,
      perm.takePayment,
      perm.reprint,
      perm.openShift,
      perm.closeShift,
    ],
  },
  {
    id: 4,
    name: "Pelayan",
    code: "waiter",
    description: "Mencatat pesanan di meja.",
    is_system: true,
    permissions: [perm.takeOrder],
  },
  {
    id: 5,
    name: "Print Station",
    code: "print-station",
    description: "Tablet Android yang mencetak tiket dapur.",
    is_system: true,
    permissions: [perm.printStation, perm.reprint],
  },
  {
    id: 6,
    name: "Gudang",
    code: "inventory",
    description: "Penerimaan dan opname stok.",
    is_system: true,
    permissions: [perm.manageStock],
  },
]

export type MockStaff = {
  id: number
  email: string | null
  full_name: string
  /** Mock fixtures only: the real API stores passwords and PINs hashed. */
  password: string | null
  pin: string | null
  is_active: boolean
  roleIds: number[]
  last_login: string | null
  date_joined: string
}

const joined = "2026-08-01T09:00:00+07:00"

/** Demo accounts. Owner and manager can sign a tablet in; everyone with a PIN can unlock it. */
export const staff: MockStaff[] = [
  {
    id: 1,
    email: "owner@warungsenja.test",
    full_name: "Rina Wijaya",
    password: "demo1234",
    pin: "1111",
    is_active: true,
    roleIds: [1],
    last_login: "2026-10-30T08:10:00+07:00",
    date_joined: joined,
  },
  {
    id: 2,
    email: "manager@warungsenja.test",
    full_name: "Dimas Pratama",
    password: "demo1234",
    pin: "2222",
    is_active: true,
    roleIds: [2],
    last_login: "2026-10-30T07:55:00+07:00",
    date_joined: joined,
  },
  {
    id: 3,
    email: null,
    full_name: "Budi Santoso",
    password: null,
    pin: "3333",
    is_active: true,
    roleIds: [3],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 4,
    email: null,
    full_name: "Sari Lestari",
    password: null,
    pin: "4444",
    is_active: true,
    roleIds: [4],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 5,
    email: null,
    full_name: "Agus Setiawan",
    password: null,
    pin: "5555",
    is_active: true,
    roleIds: [4],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 6,
    email: null,
    full_name: "Wati Rahayu",
    password: null,
    pin: "6666",
    is_active: true,
    roleIds: [6],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 7,
    email: "printer@warungsenja.test",
    full_name: "Print Station Dapur",
    password: "demo1234",
    pin: null,
    is_active: true,
    roleIds: [5],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 8,
    email: null,
    full_name: "Joko Susilo",
    password: null,
    pin: "8888",
    is_active: false,
    roleIds: [4],
    last_login: null,
    date_joined: joined,
  },
]

export function rolesOf(member: MockStaff) {
  return roles.filter((role) => member.roleIds.includes(role.id))
}

export function permissionsOf(member: MockStaff) {
  return [
    ...new Set(rolesOf(member).flatMap((role) => role.permissions)),
  ].sort()
}

export function toUser(member: MockStaff): User {
  return {
    id: member.id,
    email: member.email,
    full_name: member.full_name,
    has_pin: member.pin !== null,
    is_superuser: false,
    roles: rolesOf(member).map(({ id, code, name }) => ({ id, code, name })),
    permissions: permissionsOf(member),
  }
}

export function roleName(member: MockStaff) {
  return rolesOf(member)
    .map((role) => role.name)
    .join(", ")
}

/** The staff row as GET /staff/ returns it. */
export function toStaffRow(member: MockStaff) {
  return {
    id: member.id,
    full_name: member.full_name,
    email: member.email,
    is_active: member.is_active,
    roles: [...member.roleIds],
    role_names: rolesOf(member).map((role) => role.name),
    has_pin: member.pin !== null,
    can_sign_in: Boolean(member.email && member.password),
    last_login: member.last_login,
    date_joined: member.date_joined,
  }
}

export function toRoleRow(role: MockRole) {
  return {
    ...role,
    permissions: [...role.permissions].sort(),
    member_count: staff.filter(
      (member) => member.is_active && member.roleIds.includes(role.id)
    ).length,
  }
}
