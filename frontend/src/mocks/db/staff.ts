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
    name: "Kasir",
    code: "cashier",
    description: "Menjalankan layanan harian: kasir, shift, stok dan laporan.",
    is_system: true,
    permissions: [
      perm.takeOrder,
      perm.voidSentItem,
      perm.applyDiscount,
      perm.managePromos,
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
      perm.printStation,
    ],
  },
  {
    id: 3,
    name: "Pelayan",
    code: "waiter",
    description: "Mencatat pesanan di meja.",
    is_system: true,
    permissions: [perm.takeOrder],
  },
]

export type MockStaff = {
  id: number
  username: string
  email: string | null
  full_name: string
  /** Mock fixtures only: the real API stores passwords hashed. */
  password: string | null
  /** Approval PIN for custom roles that need someone to approve; none seeded. */
  pin?: string | null
  is_active: boolean
  roleIds: number[]
  last_login: string | null
  date_joined: string
}

const joined = "2026-08-01T09:00:00+07:00"
/** Earlier today, so the staff list reads like a working day. */
const signedInToday = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60_000).toISOString()

/** Demo accounts: everyone signs in with their own username and demo1234. */
export const staff: MockStaff[] = [
  {
    id: 1,
    username: "rina",
    email: "owner@yicipang.test",
    full_name: "Rina Wijaya",
    password: "demo1234",
    is_active: true,
    roleIds: [1],
    last_login: signedInToday(90),
    date_joined: joined,
  },
  {
    id: 2,
    username: "dimas",
    email: "dimas@yicipang.test",
    full_name: "Dimas Pratama",
    password: "demo1234",
    is_active: true,
    roleIds: [2],
    last_login: signedInToday(105),
    date_joined: joined,
  },
  {
    id: 3,
    username: "budi",
    email: null,
    full_name: "Budi Santoso",
    password: "demo1234",
    is_active: true,
    roleIds: [2],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 4,
    username: "sari",
    email: null,
    full_name: "Sari Lestari",
    password: "demo1234",
    is_active: true,
    roleIds: [3],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 5,
    username: "agus",
    email: null,
    full_name: "Agus Setiawan",
    password: "demo1234",
    is_active: true,
    roleIds: [3],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 6,
    username: "wati",
    email: null,
    full_name: "Wati Rahayu",
    password: "demo1234",
    is_active: true,
    roleIds: [2],
    last_login: null,
    date_joined: joined,
  },
  {
    id: 8,
    username: "joko",
    email: null,
    full_name: "Joko Susilo",
    password: "demo1234",
    is_active: false,
    roleIds: [3],
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
    username: member.username,
    email: member.email,
    full_name: member.full_name,
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
    username: member.username,
    email: member.email,
    is_active: member.is_active,
    roles: [...member.roleIds],
    role_names: rolesOf(member).map((role) => role.name),
    can_sign_in: member.password !== null,
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
