import { CheckIcon, PlusIcon } from "lucide-react"
import { motion } from "motion/react"
import { Fragment, useState } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { useRolesQuery } from "@/features/roles/api/roles.ts"
import { RoleEditorSheet } from "@/features/roles/components/role-editor-sheet.tsx"
import {
  permissionGroups,
  shortName,
} from "@/features/roles/lib/permission-groups.ts"
import type { Role } from "@/features/roles/schemas/role.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { spring } from "@/lib/motion.ts"

type PermKey = keyof typeof import("@/locales/id.ts").id.perms

/**
 * Every role against every action on one screen, so the owner can see at a
 * glance who may void, discount or open the drawer. Tap a role to edit it.
 */
function AccessMatrix({
  roles,
  onEdit,
}: {
  roles: Role[]
  onEdit: (role: Role) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto rounded-3xl bg-card shadow-(--shadow-soft)">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-48 bg-card p-4 text-left align-bottom font-medium text-muted-foreground">
              {t("roles.access")}
            </th>
            {roles.map((role, index) => (
              <th key={role.id} className="min-w-24 p-2 align-bottom">
                <motion.button
                  type="button"
                  onClick={() => onEdit(role)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.layout, delay: index * 0.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex w-full flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-heading font-semibold text-foreground">
                    {role.name}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("roles.members", { count: role.member_count })}
                  </span>
                </motion.button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissionGroups.map((group) => (
            <Fragment key={group.key}>
              <tr>
                <th
                  colSpan={roles.length + 1}
                  className="sticky left-0 border-t bg-muted/50 px-4 py-2 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {t(`permGroups.${group.key}`)}
                </th>
              </tr>
              {group.permissions.map((permission) => {
                const key = shortName(permission) as PermKey
                return (
                  <tr key={permission} className="group">
                    <th className="sticky left-0 z-10 border-t bg-card px-4 py-3 text-left font-normal group-hover:bg-muted/40">
                      {t(`perms.${key}.label`)}
                    </th>
                    {roles.map((role) => {
                      const on =
                        role.code === "owner" ||
                        role.permissions.includes(permission)
                      return (
                        <td
                          key={role.id}
                          className="border-t text-center group-hover:bg-muted/40"
                        >
                          {on ? (
                            <span
                              className="mx-auto grid size-7 place-items-center rounded-full bg-primary/12 text-primary"
                              aria-label="✓"
                            >
                              <CheckIcon className="size-4" strokeWidth={3} />
                            </span>
                          ) : (
                            <span
                              aria-label="—"
                              className="mx-auto block h-0.5 w-3 rounded bg-border"
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Widest access first, so the matrix reads Owner, Manager, ... down to single-purpose roles. */
function byAccess(roles: Role[]) {
  const reach = (role: Role) =>
    role.code === "owner" ? Infinity : role.permissions.length
  return [...roles].sort(
    (a, b) => reach(b) - reach(a) || a.name.localeCompare(b.name)
  )
}

export function RolesPage() {
  const { t } = useTranslation()
  const roles = useRolesQuery()
  const [editing, setEditing] = useState<Role | null | undefined>(undefined)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title={t("roles.title")}
        description={t("roles.subtitle")}
        actions={
          <Button size="touch" onClick={() => setEditing(null)}>
            <PlusIcon />
            {t("roles.add")}
          </Button>
        }
      />
      {roles.isPending ? (
        <Skeleton className="h-[520px] rounded-3xl" />
      ) : roles.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(roles.error)}</p>
      ) : (
        <AccessMatrix roles={byAccess(roles.data)} onEdit={setEditing} />
      )}
      <RoleEditorSheet role={editing} onClose={() => setEditing(undefined)} />
    </div>
  )
}
