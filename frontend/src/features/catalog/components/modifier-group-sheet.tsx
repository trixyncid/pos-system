import { useForm, useStore } from "@tanstack/react-form"
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { MoneyInput } from "@/components/ui/money-input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import {
  useDeleteModifierGroup,
  useSaveModifierGroup,
} from "@/features/catalog/api/catalog.ts"
import {
  modifierGroupFormSchema,
  type ModifierGroup,
  type ModifierGroupForm,
} from "@/features/catalog/schemas/catalog.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { fieldErrors } from "@/lib/form-errors.ts"
import { applyServerErrors } from "@/lib/form-server-errors.ts"
import { spring } from "@/lib/motion.ts"

function Editor({
  group,
  onDone,
}: {
  group: ModifierGroup | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveModifierGroup()
  const remove = useDeleteModifierGroup()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm({
    defaultValues: {
      name: group?.name ?? "",
      min_select: group?.min_select ?? 0,
      max_select: group?.max_select ?? 1,
      options: group?.options.map(({ id, name, price_delta }) => ({
        id,
        name,
        price_delta,
      })) ?? [{ name: "", price_delta: 0 }],
    } satisfies ModifierGroupForm as ModifierGroupForm,
    validators: { onSubmit: modifierGroupFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const saved = await save.mutateAsync({ id: group?.id, form: value })
        toast.success(
          t(group ? "menu.saved" : "menu.created", { name: saved.name })
        )
        onDone()
      } catch (error) {
        if (
          !applyServerErrors(formApi, error, [
            "name",
            "min_select",
            "max_select",
            "options",
          ])
        )
          toast.error(apiErrorMessage(error))
      }
    },
  })
  const submitting = useStore(form.store, (state) => state.isSubmitting)
  const optionCount = useStore(
    form.store,
    (state) => state.values.options.length
  )

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="group-name">{t("menu.groupName")}</FieldLabel>
            <Input
              id="group-name"
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

      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="min_select">
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0}>
              <FieldLabel>{t("menu.minSelect")}</FieldLabel>
              <QtyStepper
                value={field.state.value}
                min={0}
                max={optionCount}
                onChange={field.handleChange}
                labels={{ decrease: "−", increase: "+" }}
              />
              <FieldError errors={fieldErrors(field.state.meta.errors)} />
            </Field>
          )}
        </form.Field>
        <form.Field name="max_select">
          {(field) => (
            <Field>
              <FieldLabel>{t("menu.maxSelect")}</FieldLabel>
              <QtyStepper
                value={field.state.value}
                min={1}
                max={Math.max(1, optionCount)}
                onChange={field.handleChange}
                labels={{ decrease: "−", increase: "+" }}
              />
            </Field>
          )}
        </form.Field>
      </div>

      <form.Field name="options" mode="array">
        {(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel>{t("menu.options")}</FieldLabel>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {field.state.value.map((option, index) => (
                  <motion.div
                    key={option.id ?? `new-${index}`}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={spring.layout}
                    className="flex items-start gap-2"
                  >
                    <form.Field name={`options[${index}].name`}>
                      {(sub) => (
                        <div className="min-w-0 flex-1">
                          <Input
                            aria-label={t("menu.optionName")}
                            placeholder={t("menu.optionName")}
                            className="h-12 rounded-xl text-base"
                            value={sub.state.value}
                            onChange={(event) =>
                              sub.handleChange(event.target.value)
                            }
                            aria-invalid={sub.state.meta.errors.length > 0}
                          />
                          <FieldError
                            errors={fieldErrors(sub.state.meta.errors)}
                          />
                        </div>
                      )}
                    </form.Field>
                    <form.Field name={`options[${index}].price_delta`}>
                      {(sub) => (
                        <div className="w-40 shrink-0">
                          <MoneyInput
                            value={
                              sub.state.value ? String(sub.state.value) : ""
                            }
                            onChange={(digits) =>
                              sub.handleChange(Number(digits || 0))
                            }
                            className="h-12 rounded-xl text-base tabular-nums"
                            placeholder="+0"
                          />
                        </div>
                      )}
                    </form.Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-touch"
                      aria-label={t("common.cancel")}
                      disabled={field.state.value.length <= 1}
                      onClick={() => field.removeValue(index)}
                    >
                      <XIcon />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <FieldError errors={fieldErrors(field.state.meta.errors)} />
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="w-fit"
              onClick={() => field.pushValue({ name: "", price_delta: 0 })}
            >
              <PlusIcon />
              {t("menu.addOption")}
            </Button>
          </Field>
        )}
      </form.Field>

      <div className="flex gap-3">
        {group && (
          <Button
            type="button"
            variant="destructive"
            size="xl"
            aria-label={t("menu.deleteGroup")}
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
              {t("menu.deleteGroupConfirm", { name: group?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("menu.deleteGroupBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!group) return
                await remove.mutateAsync(group.id)
                toast.success(t("menu.deleted", { name: group.name }))
                onDone()
              }}
            >
              {t("menu.deleteGroup")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

export function ModifierGroupSheet({
  group,
  onClose,
}: {
  group: ModifierGroup | null | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={group !== undefined}
      onOpenChange={(open) => !open && onClose()}
      side="center"
      title={group ? group.name : t("menu.addGroup")}
      className="w-[min(560px,calc(100vw-1rem))]"
    >
      {group !== undefined && (
        <Editor key={group?.id ?? "new"} group={group} onDone={onClose} />
      )}
    </TouchSheet>
  )
}
