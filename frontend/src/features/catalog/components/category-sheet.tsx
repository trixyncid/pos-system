import { useForm, useStore } from "@tanstack/react-form"
import { Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Segmented } from "@/components/pos/segmented.tsx"
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
import {
  useDeleteCategory,
  useSaveCategory,
} from "@/features/catalog/api/catalog.ts"
import {
  categoryFormSchema,
  type Category,
  type CategoryForm,
} from "@/features/catalog/schemas/catalog.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { fieldErrors } from "@/lib/form-errors.ts"
import { applyServerErrors } from "@/lib/form-server-errors.ts"

function Editor({
  category,
  onDone,
}: {
  category: Category | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveCategory()
  const remove = useDeleteCategory()
  const form = useForm({
    defaultValues: {
      name: category?.name ?? "",
      station: category?.station ?? "kitchen",
      is_active: category?.is_active ?? true,
    } satisfies CategoryForm as CategoryForm,
    validators: { onSubmit: categoryFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const saved = await save.mutateAsync({ id: category?.id, form: value })
        toast.success(
          t(category ? "menu.saved" : "menu.created", { name: saved.name })
        )
        onDone()
      } catch (error) {
        if (!applyServerErrors(formApi, error, ["name", "station"]))
          toast.error(apiErrorMessage(error))
      }
    },
  })
  const submitting = useStore(form.store, (state) => state.isSubmitting)

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
            <FieldLabel htmlFor="category-name">
              {t("menu.categoryName")}
            </FieldLabel>
            <Input
              id="category-name"
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
      <form.Field name="station">
        {(field) => (
          <Field>
            <FieldLabel>{t("menu.station")}</FieldLabel>
            <Segmented
              label={t("menu.station")}
              value={field.state.value}
              onChange={field.handleChange}
              options={[
                { value: "kitchen", label: t("menu.stationKitchen") },
                { value: "bar", label: t("menu.stationBar") },
                { value: "none", label: t("menu.stationNone") },
              ]}
            />
            <FieldDescription>{t("menu.stationHint")}</FieldDescription>
          </Field>
        )}
      </form.Field>
      <form.Field name="is_active">
        {(field) => (
          <label
            htmlFor="category-active"
            className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-2xl bg-muted/60 px-4"
          >
            <span className="font-medium">{t("menu.categoryActive")}</span>
            <Switch
              id="category-active"
              size="lg"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
            />
          </label>
        )}
      </form.Field>

      {category && category.product_count > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("menu.categoryInUse", { count: category.product_count })}
        </p>
      )}
      <div className="flex gap-3">
        {category && (
          <Button
            type="button"
            variant="destructive"
            size="xl"
            aria-label={t("menu.deleteCategory")}
            disabled={category.product_count > 0 || remove.isPending}
            onClick={async () => {
              await remove.mutateAsync(category.id)
              toast.success(t("menu.deleted", { name: category.name }))
              onDone()
            }}
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
    </form>
  )
}

export function CategorySheet({
  category,
  onClose,
}: {
  category: Category | null | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={category !== undefined}
      onOpenChange={(open) => !open && onClose()}
      side="center"
      title={category ? t("menu.editCategory") : t("menu.addCategory")}
    >
      {category !== undefined && (
        <Editor
          key={category?.id ?? "new"}
          category={category}
          onDone={onClose}
        />
      )}
    </TouchSheet>
  )
}
