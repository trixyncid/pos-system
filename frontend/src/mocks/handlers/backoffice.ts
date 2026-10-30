import { delay, http, HttpResponse } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import { outlet } from "@/mocks/db/outlet.ts"
import {
  permissionsOf,
  roles,
  staff,
  toRoleRow,
  toStaffRow,
  type MockStaff,
} from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

/** The catalog as GET /permissions/ returns it (English names, as the backend). */
const permissionNames: Record<string, string> = {
  [perm.takeOrder]: "Can take orders",
  [perm.voidSentItem]: "Can void an item already sent to the kitchen",
  [perm.applyDiscount]: "Can apply a discount",
  [perm.managePromos]: "Can set up promos",
  [perm.approveOverride]: "Can approve a void or discount with their PIN",
  [perm.reprint]: "Can reprint a ticket or receipt",
  [perm.takePayment]: "Can take payment",
  [perm.openDrawer]: "Can open the cash drawer without a sale",
  [perm.openShift]: "Can open a shift",
  [perm.closeShift]: "Can close a shift",
  [perm.editFloor]: "Can edit the floor plan",
  [perm.manageStock]: "Can receive, count and write off stock",
  [perm.viewDashboard]: "Can view the owner dashboard",
  [perm.viewReports]: "Can view reports",
  [perm.manageStaff]: "Can manage staff and roles",
  [perm.manageSettings]: "Can change outlet settings",
  [perm.viewAudit]: "Can view the audit log",
  [perm.printStation]: "Can run the print station",
}

function unauthenticated() {
  return fail(401, "Authentication credentials were not provided.", {
    code: "not_authenticated",
  })
}

function forbidden() {
  return fail(403, "You do not have permission to perform this action.", {
    code: "permission_denied",
  })
}

function invalid(errors: Record<string, string[]>) {
  const first = Object.values(errors)[0]?.[0] ?? "Invalid input."
  return fail(400, first, { errors })
}

/** The signed-in staff member, if they hold `permission`; otherwise the error response to send. */
function actorWith(request: Request, permission: string) {
  const actor = bearerStaff(request)
  if (!actor) return { error: unauthenticated() }
  if (!permissionsOf(actor).includes(permission)) return { error: forbidden() }
  return { actor }
}

function cannotGrant(actor: MockStaff, names: string[]) {
  const held = new Set(permissionsOf(actor))
  return names.filter((name) => !held.has(name))
}

let nextStaffId = 100
let nextRoleId = 100

type StaffBody = Partial<{
  full_name: string
  username: string
  email: string | null
  password: string
  roles: number[]
  is_active: boolean
}>

function validateStaff(body: StaffBody, actor: MockStaff, target?: MockStaff) {
  const errors: Record<string, string[]> = {}
  if (body.full_name !== undefined && !body.full_name.trim())
    errors.full_name = ["This field may not be blank."]
  if (
    body.email &&
    staff.some((m) => m.email === body.email?.toLowerCase() && m !== target)
  )
    errors.email = ["Another staff member uses this email."]
  if (body.username !== undefined) {
    const username = body.username.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username))
      errors.username = [
        "Use 3–30 lowercase letters, numbers, dots, dashes or underscores.",
      ]
    else if (staff.some((m) => m.username === username && m !== target))
      errors.username = ["Another staff member uses this username."]
  }
  if (!target) {
    if (!body.username) errors.username = ["Choose a username to sign in with."]
    if (!body.password) errors.password = ["Set a password to sign in with."]
  }
  if (body.password && body.password.length < 8)
    errors.password = ["This password is too short."]
  if (target && target.id === actor.id) {
    if (body.is_active === false)
      errors.is_active = ["You cannot deactivate yourself."]
    if (
      body.roles &&
      [...body.roles].sort().join() !== [...target.roleIds].sort().join()
    )
      errors.roles = ["Ask another manager to change your own roles."]
  }
  const assigned = [...(body.roles ?? []), ...(target?.roleIds ?? [])]
  for (const roleId of assigned) {
    const role = roles.find((item) => item.id === roleId)
    if (role && cannotGrant(actor, role.permissions).length > 0) {
      errors.roles = [
        `You cannot give the role ${role.name}: it can do more than you.`,
      ]
      break
    }
  }
  return errors
}

export const backofficeHandlers = [
  http.patch(apiPath("/outlet/"), async ({ request }) => {
    const { error } = actorWith(request, perm.manageSettings)
    if (error) return error
    await delay()
    const body = (await request.json()) as Partial<typeof outlet>
    if (
      body.pbjt_percent !== undefined &&
      (body.pbjt_percent < 0 || body.pbjt_percent > 10)
    )
      return invalid({
        pbjt_percent: ["Ensure this value is less than or equal to 10."],
      })
    if (body.name !== undefined && !body.name.trim())
      return invalid({ name: ["This field may not be blank."] })
    Object.assign(outlet, body)
    return ok(outlet)
  }),

  http.get(apiPath("/permissions/"), ({ request }) => {
    const { error } = actorWith(request, perm.manageStaff)
    if (error) return error
    return ok(
      Object.entries(permissionNames).map(([codename, name]) => ({
        codename,
        name,
      }))
    )
  }),

  http.get(apiPath("/staff/"), async ({ request }) => {
    const { error } = actorWith(request, perm.manageStaff)
    if (error) return error
    await delay()
    const url = new URL(request.url)
    const search = url.searchParams.get("search")?.trim().toLowerCase() ?? ""
    const active = url.searchParams.get("active")
    const rows = staff
      .filter(
        (m) =>
          !search ||
          m.full_name.toLowerCase().includes(search) ||
          (m.email ?? "").includes(search) ||
          m.username.includes(search)
      )
      .filter((m) => active === null || String(m.is_active) === active)
      .sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) ||
          a.full_name.localeCompare(b.full_name)
      )
      .map(toStaffRow)
    return HttpResponse.json({
      success: true,
      count: rows.length,
      next: null,
      previous: null,
      results: rows,
    })
  }),

  http.post(apiPath("/staff/"), async ({ request }) => {
    const { actor, error } = actorWith(request, perm.manageStaff)
    if (error) return error
    await delay()
    const body = (await request.json()) as StaffBody
    const errors = validateStaff({ full_name: "", ...body }, actor)
    if (Object.keys(errors).length) return invalid(errors)
    const member: MockStaff = {
      id: nextStaffId++,
      full_name: body.full_name!.trim(),
      username: body.username!.trim().toLowerCase(),
      email: body.email?.toLowerCase() || null,
      password: body.password || null,
      is_active: body.is_active ?? true,
      roleIds: body.roles ?? [],
      last_login: null,
      date_joined: new Date().toISOString(),
    }
    staff.push(member)
    return ok(toStaffRow(member), { status: 201 })
  }),

  http.patch(apiPath("/staff/:id/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.manageStaff)
    if (error) return error
    await delay()
    const target = staff.find((m) => m.id === Number(params.id))
    if (!target) return fail(404, "Not found.", { code: "not_found" })
    const body = (await request.json()) as StaffBody
    const errors = validateStaff(body, actor, target)
    if (Object.keys(errors).length) return invalid(errors)
    if (body.full_name !== undefined) target.full_name = body.full_name.trim()
    if (body.username !== undefined)
      target.username = body.username.trim().toLowerCase()
    if (body.email !== undefined)
      target.email = body.email?.toLowerCase() || null
    if (body.password) target.password = body.password
    if (body.roles) target.roleIds = [...body.roles]
    if (body.is_active !== undefined) target.is_active = body.is_active
    return ok(toStaffRow(target))
  }),

  http.get(apiPath("/roles/"), async ({ request }) => {
    const { error } = actorWith(request, perm.manageStaff)
    if (error) return error
    await delay()
    return ok(
      [...roles]
        .sort(
          (a, b) =>
            Number(b.is_system) - Number(a.is_system) ||
            a.name.localeCompare(b.name)
        )
        .map(toRoleRow)
    )
  }),

  http.post(apiPath("/roles/"), async ({ request }) => {
    const { actor, error } = actorWith(request, perm.manageStaff)
    if (error) return error
    await delay()
    const body = (await request.json()) as Partial<{
      name: string
      code: string
      description: string
      permissions: string[]
    }>
    const errors: Record<string, string[]> = {}
    if (!body.name?.trim()) errors.name = ["This field may not be blank."]
    if (
      roles.some(
        (r) => r.name.toLowerCase() === body.name?.trim().toLowerCase()
      )
    )
      errors.name = ["Another role already has this name."]
    if (!body.code) errors.code = ["This field is required."]
    if (roles.some((r) => r.code === body.code))
      errors.code = ["Another role already uses this code."]
    const denied = cannotGrant(actor, body.permissions ?? [])
    if (denied.length)
      errors.permissions = [
        `You cannot grant permissions you do not have: ${denied.join(", ")}.`,
      ]
    if (Object.keys(errors).length) return invalid(errors)
    const role = {
      id: nextRoleId++,
      name: body.name!.trim(),
      code: body.code!,
      description: body.description ?? "",
      is_system: false,
      permissions: body.permissions ?? [],
    }
    roles.push(role)
    return ok(toRoleRow(role), { status: 201 })
  }),

  http.patch(apiPath("/roles/:id/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.manageStaff)
    if (error) return error
    await delay()
    const role = roles.find((r) => r.id === Number(params.id))
    if (!role) return fail(404, "Not found.", { code: "not_found" })
    const body = (await request.json()) as Partial<{
      name: string
      code: string
      description: string
      permissions: string[]
    }>
    const errors: Record<string, string[]> = {}
    if (role.is_system && body.code && body.code !== role.code)
      errors.code = ["A built-in role keeps its code."]
    if (role.code === "owner" && body.permissions)
      errors.permissions = ["The Owner role always has every permission."]
    if (
      body.name !== undefined &&
      roles.some(
        (r) =>
          r !== role && r.name.toLowerCase() === body.name?.trim().toLowerCase()
      )
    )
      errors.name = ["Another role already has this name."]
    if (body.permissions) {
      const denied = cannotGrant(actor, body.permissions)
      if (denied.length)
        errors.permissions = [
          `You cannot grant permissions you do not have: ${denied.join(", ")}.`,
        ]
      const ownRole = actor.roleIds.includes(role.id)
      const otherwiseManages = roles.some(
        (r) =>
          r !== role &&
          actor.roleIds.includes(r.id) &&
          r.permissions.includes(perm.manageStaff)
      )
      if (
        ownRole &&
        !otherwiseManages &&
        !body.permissions.includes(perm.manageStaff)
      )
        errors.permissions = [
          "This would remove your own access to staff and roles.",
        ]
    }
    if (Object.keys(errors).length) return invalid(errors)
    if (body.name !== undefined) role.name = body.name.trim()
    if (body.code !== undefined) role.code = body.code
    if (body.description !== undefined) role.description = body.description
    if (body.permissions) role.permissions = [...body.permissions]
    return ok(toRoleRow(role))
  }),

  http.delete(apiPath("/roles/:id/"), async ({ request, params }) => {
    const { error } = actorWith(request, perm.manageStaff)
    if (error) return error
    await delay()
    const role = roles.find((r) => r.id === Number(params.id))
    if (!role) return fail(404, "Not found.", { code: "not_found" })
    if (role.is_system) return fail(400, "Built-in roles cannot be deleted.")
    if (toRoleRow(role).member_count)
      return fail(400, "Move its staff to another role first.")
    roles.splice(roles.indexOf(role), 1)
    return ok(undefined)
  }),
]
