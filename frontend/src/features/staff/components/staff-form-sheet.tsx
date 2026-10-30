import { useForm, useStore } from "@tanstack/react-form"
import { CheckIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
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
import { useRolesQuery } from "@/features/roles/api/roles.ts"
import { useSaveStaff } from "@/features/staff/api/staff.ts"
import {
  staffFormSchema,
  type Staff,
  type StaffForm,
} from "@/features/staff/schemas/staff.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { fieldErrors } from "@/lib/form-errors.ts"
import { applyServerErrors } from "@/lib/form-server-errors.ts"
import { cn } from "@/lib/utils.ts"

const serverFields = [
  "full_name",
  "email",
  "password",
  "pin",
  "roles",
  "is_active",
] as const

function Editor({
  member,
  onDone,
}: {
  member: Staff | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const roles = useRolesQuery()
  const save = useSaveStaff()
  const isNew = member === null

  const form = useForm({
    defaultValues: {
      full_name: member?.full_name ?? "",
      email: member?.email ?? "",
      password: "",
      pin: "",
      roles: member?.roles ?? [],
      is_active: member?.is_active ?? true,
    } satisfies StaffForm as StaffForm,
    validators: { onSubmit: staffFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const saved = await save.mutateAsync({ id: member?.id, form: value })
        toast.success(
          t(isNew ? "staff.created" : "staff.updated", {
            name: saved.full_name,
          })
        )
        onDone()
      } catch (error) {
        if (!applyServerErrors(formApi, error, serverFields))
          toast.error(apiErrorMessage(error))
      }
    },
  })
  const email = useStore(form.store, (state) => state.values.email)
  const submitting = useStore(form.store, (state) => state.isSubmitting)

  const input = (
    name: "full_name" | "email" | "password" | "pin",
    label: string,
    props: React.ComponentProps<typeof Input>,
    hint?: string
  ) => (
    <form.Field name={name}>
      {(field) => (
        <Field data-invalid={field.state.meta.errors.length > 0}>
          <FieldLabel htmlFor={`staff-${name}`}>{label}</FieldLabel>
          <Input
            id={`staff-${name}`}
            className="h-12 rounded-xl text-base"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            aria-invalid={field.state.meta.errors.length > 0}
            {...props}
          />
          {hint && <FieldDescription>{hint}</FieldDescription>}
          <FieldError errors={fieldErrors(field.state.meta.errors)} />
        </Field>
      )}
    </form.Field>
  )

  return (
    <form
      id="staff-form"
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      {input("full_name", t("staff.fullName"), { autoComplete: "off" })}
      {input("email", t("staff.email"), {
        type: "email",
        inputMode: "email",
        autoComplete: "off",
      })}
      {email.trim() !== "" &&
        input(
          "password",
          t("staff.password"),
          { type: "password", autoComplete: "new-password" },
          t("staff.passwordHint")
        )}
      {isNew &&
        input(
          "pin",
          t("staff.pin"),
          {
            type: "password",
            inputMode: "numeric",
            maxLength: 6,
            autoComplete: "off",
            className: "h-12 w-40 rounded-xl text-base tracking-[0.4em]",
          },
          t("staff.pinHint")
        )}

      <form.Field name="roles">
        {(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel>{t("staff.roles")}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {roles.data?.map((role) => {
                const on = field.state.value.includes(role.id)
                return (
                  <Pressable
                    key={role.id}
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      field.handleChange(
                        on
                          ? field.state.value.filter((id) => id !== role.id)
                          : [...field.state.value, role.id]
                      )
                    }
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-accent-foreground"
                        : "bg-background text-muted-foreground"
                    )}
                  >
                    {on && <CheckIcon className="size-4" />}
                    {role.name}
                  </Pressable>
                )
              })}
            </div>
            <FieldDescription>{t("staff.rolesHint")}</FieldDescription>
            <FieldError errors={fieldErrors(field.state.meta.errors)} />
          </Field>
        )}
      </form.Field>

      {!isNew && (
        <form.Field name="is_active">
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/60 p-4">
                <div>
                  <FieldLabel htmlFor="staff-active">
                    {t("staff.activeLabel")}
                  </FieldLabel>
                  <FieldDescription>{t("staff.activeHint")}</FieldDescription>
                </div>
                <Switch
                  id="staff-active"
                  size="lg"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
              <FieldError errors={fieldErrors(field.state.meta.errors)} />
            </Field>
          )}
        </form.Field>
      )}

      <Button type="submit" size="xl" className="w-full" disabled={submitting}>
        {submitting && <Spinner />}
        {t("common.save")}
      </Button>
    </form>
  )
}

/** Create or edit a staff member. `member` undefined = closed, null = new. */
export function StaffFormSheet({
  member,
  onClose,
}: {
  member: Staff | null | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={member !== undefined}
      onOpenChange={(open) => !open && onClose()}
      side="right"
      title={member ? t("staff.editTitle") : t("staff.newTitle")}
      description={t("staff.formHint")}
    >
      {member !== undefined && (
        <Editor key={member?.id ?? "new"} member={member} onDone={onClose} />
      )}
    </TouchSheet>
  )
}
