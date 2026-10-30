import { useForm, useStore } from "@tanstack/react-form"
import { ArchiveIcon, CameraIcon, CheckIcon } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
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
import { MoneyInput } from "@/components/ui/money-input.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import {
  useArchiveProduct,
  useCategoriesQuery,
  useModifierGroupsQuery,
  useProductsQuery,
  useSaveProduct,
  useUploadProductImage,
} from "@/features/catalog/api/catalog.ts"
import {
  RecipeEditor,
  recipeCost,
} from "@/features/catalog/components/recipe-editor.tsx"
import {
  costRatio,
  costTone,
  formatPercent,
} from "@/features/catalog/lib/catalog.ts"
import {
  productFormSchema,
  type Product,
  type ProductForm,
  type ProductKind,
} from "@/features/catalog/schemas/catalog.ts"
import { apiErrorMessage, apiFieldErrors } from "@/lib/api-error.ts"
import { fieldErrors } from "@/lib/form-errors.ts"
import { applyServerErrors } from "@/lib/form-server-errors.ts"
import { cn } from "@/lib/utils.ts"

const serverFields = [
  "name",
  "description",
  "category",
  "price",
  "cost",
  "unit",
  "barcode",
  "sku",
  "tax_category",
  "modifier_groups",
  "recipe",
] as const

function defaults(
  kind: ProductKind,
  product: Product | null,
  category: string | null
): ProductForm {
  return {
    kind,
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? (kind === "ingredient" ? null : category),
    price: product?.price ?? 0,
    cost: product?.cost ?? 0,
    unit:
      product?.unit ??
      (kind === "menu" ? "portion" : kind === "retail" ? "pcs" : "g"),
    barcode: product?.barcode ?? "",
    sku: product?.sku ?? "",
    tax_category:
      product?.tax_category ??
      (kind === "menu" ? "pbjt" : kind === "retail" ? "ppn" : "none"),
    track_stock: product?.track_stock ?? kind !== "menu",
    is_available: product?.is_available ?? true,
    is_favorite: product?.is_favorite ?? false,
    modifier_groups: product?.modifier_groups ?? [],
    recipe:
      product?.recipe.map(({ ingredient, quantity }) => ({
        ingredient,
        quantity,
      })) ?? [],
  }
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-16 cursor-pointer items-center justify-between gap-4 px-4 py-3"
    >
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <Switch id={id} size="lg" checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-heading font-semibold">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Editor({
  kind,
  product,
  initialCategory,
  onDone,
}: {
  kind: ProductKind
  product: Product | null
  initialCategory: string | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const categories = useCategoriesQuery()
  const groups = useModifierGroupsQuery()
  const ingredients = useProductsQuery("ingredient")
  const save = useSaveProduct()
  const upload = useUploadProductImage()
  const archive = useArchiveProduct()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(
    product?.image_url ?? null
  )
  const [confirmArchive, setConfirmArchive] = useState(false)

  const form = useForm({
    defaultValues: defaults(kind, product, initialCategory),
    validators: { onSubmit: productFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const saved = await save.mutateAsync({ id: product?.id, form: value })
        if (pendingFile)
          await upload.mutateAsync({ id: saved.id, file: pendingFile })
        toast.success(
          t(product ? "menu.saved" : "menu.created", { name: saved.name })
        )
        onDone()
      } catch (error) {
        if (!applyServerErrors(formApi, error, serverFields))
          toast.error(apiErrorMessage(error))
      }
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const submitting = useStore(form.store, (state) => state.isSubmitting)

  const pickPhoto = async (file: File) => {
    setPreview(URL.createObjectURL(file))
    if (!product) {
      setPendingFile(file)
      return
    }
    try {
      await upload.mutateAsync({ id: product.id, file })
      toast.success(t("menu.photoUploaded"))
    } catch (error) {
      toast.error(apiFieldErrors(error).image ?? apiErrorMessage(error))
      setPreview(product.image_url)
    }
  }

  const ingredientList = (ingredients.data ?? []).filter(
    (item) => item.id !== product?.id
  )
  const cost =
    kind === "menu" && values.recipe.length
      ? recipeCost(values.recipe, ingredientList)
      : values.cost
  const ratio = kind === "ingredient" ? null : costRatio(values.price, cost)
  const sellable = kind !== "ingredient"

  const textInput = (
    name: "name" | "description" | "sku" | "barcode",
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    hint?: string
  ) => (
    <form.Field name={name}>
      {(field) => (
        <Field data-invalid={field.state.meta.errors.length > 0}>
          <FieldLabel htmlFor={`product-${name}`}>{label}</FieldLabel>
          <Input
            id={`product-${name}`}
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

  const moneyInput = (name: "price" | "cost", label: string) => (
    <form.Field name={name}>
      {(field) => (
        <Field data-invalid={field.state.meta.errors.length > 0}>
          <FieldLabel htmlFor={`product-${name}`}>{label}</FieldLabel>
          <MoneyInput
            id={`product-${name}`}
            value={field.state.value ? String(field.state.value) : ""}
            onChange={(digits) => field.handleChange(Number(digits || 0))}
            onBlur={field.handleBlur}
            invalid={field.state.meta.errors.length > 0}
            className="h-12 rounded-xl text-base tabular-nums"
          />
          <FieldError errors={fieldErrors(field.state.meta.errors)} />
        </Field>
      )}
    </form.Field>
  )

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      {sellable && (
        <div className="relative overflow-hidden rounded-3xl">
          <ProductImage
            src={preview}
            alt={values.name || "?"}
            className="aspect-16/9"
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void pickPhoto(file)
              event.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="absolute right-3 bottom-3 bg-background/85 backdrop-blur"
            disabled={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            {upload.isPending ? <Spinner /> : <CameraIcon />}
            {preview ? t("menu.changePhoto") : t("menu.addPhoto")}
          </Button>
          {pendingFile && (
            <p className="absolute bottom-3 left-3 rounded-full bg-background/85 px-3 py-1 text-xs backdrop-blur">
              {t("menu.photoAfterSave")}
            </p>
          )}
        </div>
      )}

      <div className="space-y-5">
        {textInput("name", t("menu.name"), { autoComplete: "off" })}
        {kind === "menu" && textInput("description", t("menu.description"))}
        {sellable && (
          <form.Field name="category">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel>{t("menu.category")}</FieldLabel>
                <Select
                  value={field.state.value ?? undefined}
                  onValueChange={field.handleChange}
                >
                  <SelectTrigger
                    size="lg"
                    className="w-full"
                    aria-invalid={field.state.meta.errors.length > 0}
                  >
                    <SelectValue placeholder={t("menu.pickCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.data?.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        className="h-11 text-base"
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={fieldErrors(field.state.meta.errors)} />
              </Field>
            )}
          </form.Field>
        )}
        {kind === "retail" && (
          <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
            {textInput(
              "barcode",
              t("menu.barcode"),
              {
                inputMode: "numeric",
                autoComplete: "off",
                className: "h-12 rounded-xl font-mono text-base",
              },
              t("menu.barcodeHint")
            )}
            {textInput("sku", t("menu.sku"), {
              autoComplete: "off",
              className: "h-12 rounded-xl font-mono text-base",
            })}
          </div>
        )}
      </div>

      <Section title={kind === "ingredient" ? t("menu.cost") : t("menu.price")}>
        <div className="grid gap-5 sm:grid-cols-2">
          {sellable && moneyInput("price", t("menu.price"))}
          {(kind !== "menu" || values.recipe.length === 0) &&
            moneyInput(
              "cost",
              kind === "ingredient"
                ? t("menu.costPerUnit", {
                    unit: t(`menu.units.${values.unit}`),
                  })
                : t("menu.cost")
            )}
          {kind !== "menu" && (
            <form.Field name="unit">
              {(field) => (
                <Field>
                  <FieldLabel>{t("menu.unit")}</FieldLabel>
                  <Segmented
                    label={t("menu.unit")}
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={(kind === "ingredient"
                      ? (["g", "ml", "pcs"] as const)
                      : (["pcs"] as const)
                    ).map((unit) => ({
                      value: unit,
                      label: t(`menu.units.${unit}`),
                    }))}
                  />
                </Field>
              )}
            </form.Field>
          )}
        </div>
        {ratio !== null && (
          <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {kind === "menu" ? t("menu.foodCost") : t("menu.margin")}
            </span>
            <span className="flex items-center gap-3">
              <MoneyText amount={cost} className="text-muted-foreground" />
              <StatusPill tone={costTone(ratio, kind)}>
                {kind === "menu"
                  ? formatPercent(ratio)
                  : formatPercent(1 - ratio)}
              </StatusPill>
            </span>
          </div>
        )}
        {sellable && (
          <form.Field name="tax_category">
            {(field) => (
              <Field>
                <FieldLabel>{t("menu.tax")}</FieldLabel>
                <Segmented
                  label={t("menu.tax")}
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={[
                    { value: "pbjt", label: t("menu.taxPbjt") },
                    { value: "ppn", label: t("menu.taxPpn") },
                    { value: "none", label: t("menu.taxNone") },
                  ]}
                />
              </Field>
            )}
          </form.Field>
        )}
      </Section>

      {kind === "menu" && (
        <Section title={t("menu.modifiers")} hint={t("menu.modifiersHint")}>
          <form.Field name="modifier_groups">
            {(field) => (
              <div className="flex flex-wrap gap-2">
                {groups.data?.map((group) => {
                  const on = field.state.value.includes(group.id)
                  return (
                    <Pressable
                      key={group.id}
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        field.handleChange(
                          on
                            ? field.state.value.filter((id) => id !== group.id)
                            : [...field.state.value, group.id]
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
                      {group.name}
                    </Pressable>
                  )
                })}
              </div>
            )}
          </form.Field>
        </Section>
      )}

      {kind === "menu" && (
        <Section title={t("menu.recipe")} hint={t("menu.recipeHint")}>
          <form.Field name="recipe">
            {(field) => (
              <>
                <RecipeEditor
                  value={field.state.value}
                  onChange={field.handleChange}
                  ingredients={ingredientList}
                />
                <FieldError errors={fieldErrors(field.state.meta.errors)} />
              </>
            )}
          </form.Field>
        </Section>
      )}

      <div className="divide-y overflow-hidden rounded-2xl border">
        {sellable && (
          <form.Field name="is_available">
            {(field) => (
              <SwitchRow
                id="product-available"
                label={t("menu.available")}
                hint={t("menu.availableHint")}
                checked={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        )}
        {kind === "menu" && (
          <form.Field name="is_favorite">
            {(field) => (
              <SwitchRow
                id="product-favorite"
                label={t("menu.favorite")}
                hint={t("menu.favoriteHint")}
                checked={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        )}
        {kind !== "menu" && (
          <form.Field name="track_stock">
            {(field) => (
              <SwitchRow
                id="product-track"
                label={t("menu.trackStock")}
                hint={t("menu.trackStockHint")}
                checked={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        )}
      </div>

      <div className="sticky -bottom-6 -mx-6 -mb-6 flex gap-3 border-t bg-card/95 px-6 py-4 backdrop-blur">
        {product && (
          <Button
            type="button"
            variant="destructive"
            size="xl"
            aria-label={t("menu.archive")}
            onClick={() => setConfirmArchive(true)}
          >
            <ArchiveIcon />
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

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("menu.archiveConfirm", { name: product?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("menu.archiveBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!product) return
                await archive.mutateAsync(product.id)
                toast.success(t("menu.archived", { name: product.name }))
                onDone()
              }}
            >
              {t("menu.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

/** Create or edit any product. `product` undefined = closed, null = new of `kind`. */
export function ProductSheet({
  kind,
  product,
  initialCategory = null,
  onClose,
}: {
  kind: ProductKind
  product: Product | null | undefined
  initialCategory?: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const title = product
    ? product.name
    : kind === "menu"
      ? t("menu.newItem")
      : kind === "retail"
        ? t("menu.newProduct")
        : t("menu.newIngredient")
  return (
    <TouchSheet
      open={product !== undefined}
      onOpenChange={(open) => !open && onClose()}
      side="right"
      title={title}
      className="w-[min(640px,calc(100vw-1rem))]"
    >
      {product !== undefined && (
        <Editor
          key={product?.id ?? `new-${kind}`}
          kind={product?.kind ?? kind}
          product={product}
          initialCategory={initialCategory}
          onDone={onClose}
        />
      )}
    </TouchSheet>
  )
}
