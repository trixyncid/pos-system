import { useForm, useStore } from "@tanstack/react-form"
import { LockIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { useDeleteRole, useSaveRole } from "@/features/roles/api/roles.ts"
import {
  pagesOpenedBy,
  permissionGroups,
  shortName,
} from "@/features/roles/lib/permission-groups.ts"
import {
  roleFormSchema,
  slugify,
  type Role,
  type RoleForm,
} from "@/features/roles/schemas/role.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { fieldErrors } from "@/lib/form-errors.ts"
import { applyServerErrors } from "@/lib/form-server-errors.ts"

function Editor({ role, onDone }: { role: Role | null; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveRole()
  const remove = useDeleteRole()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isNew = role === null
  const isOwner = role?.code === "owner"
  // A new role's code follows its name until someone edits the code itself.
  const [codeTouched, setCodeTouched] = useState(!isNew)

  const form = useForm({
    defaultValues: {
      name: role?.name ?? "",
      code: role?.code ?? "",
      description: role?.description ?? "",
      permissions: role?.permissions ?? [],
    } satisfies RoleForm as RoleForm,
    validators: { onSubmit: roleFormSchema },
    onSubmit: async ({ value, formApi }) => {
      // The Owner role's permissions are fixed; sending them would be rejected.
      const body: Partial<RoleForm> = isOwner
        ? { name: value.name, description: value.description }
        : value
      try {
        const saved = await save.mutateAsync({ id: role?.id, form: body })
        toast.success(t("roles.saved", { name: saved.name }))
        onDone()
      } catch (error) {
        if (
          !applyServerErrors(formApi, error, [
            "name",
            "code",
            "description",
            "permissions",
          ])
        )
          toast.error(apiErrorMessage(error))
      }
    },
  })
  const submitting = useStore(form.store, (state) => state.isSubmitting)

  const destroy = async () => {
    if (!role) return
    await remove.mutateAsync(role.id)
    toast.success(t("roles.deleted", { name: role.name }))
    onDone()
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field
          name="name"
          listeners={{
            onChange: ({ value }) => {
              if (!codeTouched) form.setFieldValue("code", slugify(value))
            },
          }}
        >
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <FieldLabel htmlFor="role-name">{t("roles.name")}</FieldLabel>
              <Input
                id="role-name"
                className="h-12 rounded-xl text-base"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
              />
              <FieldError errors={fieldErrors(field.state.meta.errors)} />
            </Field>
          )}
        </form.Field>
        <form.Field name="code">
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <FieldLabel htmlFor="role-code">{t("roles.code")}</FieldLabel>
              <Input
                id="role-code"
                className="h-12 rounded-xl font-mono text-base"
                value={field.state.value}
                disabled={role?.is_system}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setCodeTouched(true)
                  field.handleChange(event.target.value)
                }}
                aria-invalid={field.state.meta.errors.length > 0}
              />
              <FieldDescription>{t("roles.codeHint")}</FieldDescription>
              <FieldError errors={fieldErrors(field.state.meta.errors)} />
            </Field>
          )}
        </form.Field>
      </div>
      <form.Field name="description">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="role-description">
              {t("roles.description")}
            </FieldLabel>
            <Input
              id="role-description"
              className="h-12 rounded-xl text-base"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </Field>
        )}
      </form.Field>

      <form.Field name="permissions">
        {(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel>{t("roles.access")}</FieldLabel>
            {isOwner && (
              <p className="flex items-start gap-2 rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
                <LockIcon className="mt-0.5 size-4 shrink-0" />
                {t("roles.ownerLocked")}
              </p>
            )}
            <FieldError errors={fieldErrors(field.state.meta.errors)} />
            <div className="space-y-5">
              {permissionGroups.map((group) => (
                <div key={group.key}>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t(`permGroups.${group.key}`)}
                  </p>
                  <div className="divide-y overflow-hidden rounded-2xl border">
                    {group.permissions.map((permission) => {
                      const key = shortName(
                        permission
                      ) as keyof typeof import("@/locales/id.ts").id.perms
                      const on = field.state.value.includes(permission)
                      const opens = pagesOpenedBy(permission)
                      const id = `perm-${key}`
                      return (
                        <label
                          key={permission}
                          htmlFor={id}
                          className="flex min-h-16 cursor-pointer items-center gap-4 px-4 py-3 transition-colors has-[[data-state=checked]]:bg-primary/5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">
                              {t(`perms.${key}.label`)}
                            </span>
                            <span className="block text-sm text-muted-foreground">
                              {t(`perms.${key}.hint`)}
                              {opens.length > 0 &&
                                ` · ${t("roles.opens", {
                                  pages: opens
                                    .map((page) => t(`nav.${page.key}`))
                                    .join(", "),
                                })}`}
                            </span>
                          </span>
                          <Switch
                            id={id}
                            size="lg"
                            disabled={isOwner}
                            checked={isOwner || on}
                            onCheckedChange={(checked) =>
                              field.handleChange(
                                checked
                                  ? [...field.state.value, permission]
                                  : field.state.value.filter(
                                      (p) => p !== permission
                                    )
                              )
                            }
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Field>
        )}
      </form.Field>

      <div className="flex gap-3">
        {role && !role.is_system && (
          <Button
            type="button"
            variant="destructive"
            size="xl"
            disabled={role.member_count > 0}
            title={
              role.member_count > 0
                ? t("roles.members", { count: role.member_count })
                : undefined
            }
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2Icon />
          </Button>
        )}
        <Button
          type="submit"
          size="xl"
          className="flex-1"
          disabled={submitting}
        >
          {submitting && <Spinner />}
          {t("common.save")}
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("roles.deleteConfirm", { name: role?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("roles.deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void destroy()}
            >
              {t("roles.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

/** `role` undefined = closed, null = new role. */
export function RoleEditorSheet({
  role,
  onClose,
}: {
  role: Role | null | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={role !== undefined}
      onOpenChange={(open) => !open && onClose()}
      side="right"
      title={role ? role.name : t("roles.newTitle")}
      description={role?.description || undefined}
      className="w-[min(640px,calc(100vw-1rem))]"
    >
      {role !== undefined && (
        <Editor key={role?.id ?? "new"} role={role} onDone={onClose} />
      )}
    </TouchSheet>
  )
}
