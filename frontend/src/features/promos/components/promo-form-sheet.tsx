import { ImageIcon, SearchIcon, XIcon } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ImageCropDialog } from "@/components/image-crop-dialog.tsx"
import { Pressable } from "@/components/motion/pressable.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { MoneyInput } from "@/components/ui/money-input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import {
  useCategoriesQuery,
  useProductsQuery,
} from "@/features/catalog/api/catalog.ts"
import {
  useSavePromo,
  useUploadPromoImage,
} from "@/features/promos/api/promos.ts"
import { dayNames } from "@/features/promos/lib/describe.ts"
import type { Promo, PromoForm } from "@/features/promos/schemas/promo.ts"
import { apiErrorMessage, apiFieldErrors } from "@/lib/api-error.ts"
import {
  ACCEPTED_IMAGE_TYPES,
  imagePresets,
  MAX_SOURCE_BYTES,
} from "@/lib/image-presets.ts"
import { cn } from "@/lib/utils.ts"

const blank: PromoForm = {
  name: "",
  description: "",
  kind: "bill",
  benefit: "percent",
  value: 10,
  max_discount: null,
  min_spend: 0,
  products: [],
  categories: [],
  buy_quantity: 2,
  get_quantity: 1,
  channel: "all",
  starts_on: null,
  ends_on: null,
  weekdays: [],
  starts_at: null,
  ends_at: null,
  is_active: true,
}

function toForm(promo: Promo | null): PromoForm {
  if (!promo) return blank
  return Object.fromEntries(
    Object.keys(blank).map((key) => [key, promo[key as keyof PromoForm]])
  ) as PromoForm
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-background p-4">
      <h3 className="font-heading font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Label({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      {children}
      {error && <p className="text-sm text-danger-ink">{error}</p>}
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl border px-3 text-sm font-medium transition-colors",
        on ? "border-primary bg-primary/10 text-accent-foreground" : "bg-card"
      )}
    >
      {children}
    </Pressable>
  )
}

const toggle = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

/** "14:00:00" → "14:00" for <input type="time">, and back. */
const timeValue = (text: string | null) => (text ? text.slice(0, 5) : "")

function Targets({
  form,
  set,
  error,
}: {
  form: PromoForm
  set: (patch: Partial<PromoForm>) => void
  error?: string
}) {
  const { t } = useTranslation()
  const categories = useCategoriesQuery()
  const menu = useProductsQuery("menu")
  const retail = useProductsQuery("retail")
  const [query, setQuery] = useState("")
  const all = [...(menu.data ?? []), ...(retail.data ?? [])]
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? all
        .filter(
          (p) =>
            !form.products.includes(p.id) &&
            p.name.toLowerCase().includes(needle)
        )
        .slice(0, 6)
    : []
  const chosen = all.filter((p) => form.products.includes(p.id))

  return (
    <Section title={t("promos.form.targets")}>
      <p className="text-sm text-muted-foreground">
        {t("promos.form.targetsHint")}
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.data?.map((category) => (
          <Chip
            key={category.id}
            on={form.categories.includes(category.id)}
            onClick={() =>
              set({ categories: toggle(form.categories, category.id) })
            }
          >
            {category.name}
          </Chip>
        ))}
      </div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("promos.form.addItem")}
          aria-label={t("promos.form.addItem")}
          className="h-11 rounded-xl pl-11 text-base"
        />
        {matches.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 space-y-1 rounded-2xl border bg-popover p-1.5 shadow-(--shadow-raised)">
            {matches.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => {
                    set({ products: [...form.products, product.id] })
                    setQuery("")
                  }}
                  className="flex h-11 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-muted"
                >
                  <ProductImage
                    src={product.image_url}
                    alt=""
                    className="size-8 rounded-lg"
                  />
                  <span className="truncate">{product.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chosen.map((product) => (
            <span
              key={product.id}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary/10 pr-1 pl-3 text-sm font-medium"
            >
              {product.name}
              <button
                type="button"
                aria-label={t("promos.form.removeItem", { name: product.name })}
                onClick={() =>
                  set({
                    products: form.products.filter((id) => id !== product.id),
                  })
                }
                className="grid size-7 place-items-center rounded-lg hover:bg-background"
              >
                <XIcon className="size-4" />
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-danger-ink">{error}</p>}
    </Section>
  )
}

function Body({ promo, onDone }: { promo: Promo | null; onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const save = useSavePromo()
  const upload = useUploadPromoImage()
  const [form, setForm] = useState<PromoForm>(() => toForm(promo))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(promo?.image_url ?? null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [cropping, setCropping] = useState<{
    source: string
    name: string
  } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<PromoForm>) => {
    setForm((current) => ({ ...current, ...patch }))
    setErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }
  const days = dayNames(i18n.language)

  const pick = (file: File) => {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type))
      return toast.error(t("crop.wrongType"))
    if (file.size > MAX_SOURCE_BYTES) return toast.error(t("crop.tooBig"))
    setCropping({ source: URL.createObjectURL(file), name: file.name })
  }

  const submit = async () => {
    try {
      const saved = await save.mutateAsync({ id: promo?.id, form })
      if (bannerFile)
        await upload.mutateAsync({ id: saved.id, file: bannerFile })
      toast.success(
        t(promo ? "promos.saved" : "promos.created", { name: saved.name })
      )
      onDone()
    } catch (error) {
      const fields = apiFieldErrors(error)
      setErrors(fields)
      if (Object.keys(fields).length === 0) toast.error(apiErrorMessage(error))
    }
  }

  const percent = form.kind === "bundle" || form.benefit === "percent"

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl">
        {banner ? (
          <img src={banner} alt="" className="aspect-2/1 w-full object-cover" />
        ) : (
          <div className="grid aspect-2/1 w-full place-items-center bg-linear-to-br from-primary/25 to-chart-3/20 text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) pick(file)
            event.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="touch"
          className="absolute right-3 bottom-3 bg-background/85 backdrop-blur"
          onClick={() => fileInput.current?.click()}
        >
          <ImageIcon />
          {banner ? t("promos.form.changeBanner") : t("promos.form.addBanner")}
        </Button>
        <ImageCropDialog
          key={cropping?.source}
          source={cropping?.source ?? null}
          fileName={cropping?.name ?? "promo"}
          preset={imagePresets.promo}
          title={t("crop.promoTitle")}
          onCancel={() => setCropping(null)}
          onCropped={(file) => {
            setCropping(null)
            setBannerFile(file)
            setBanner(URL.createObjectURL(file))
          }}
        />
      </div>

      <Label error={errors.name}>
        <Input
          value={form.name}
          onChange={(event) => set({ name: event.target.value })}
          maxLength={80}
          placeholder={t("promos.form.name")}
          aria-label={t("promos.form.name")}
          aria-invalid={Boolean(errors.name)}
          className="h-12 rounded-xl text-base"
        />
      </Label>
      <Input
        value={form.description}
        onChange={(event) => set({ description: event.target.value })}
        maxLength={200}
        placeholder={t("promos.form.description")}
        aria-label={t("promos.form.description")}
        className="h-12 rounded-xl text-base"
      />

      <Section title={t("promos.form.kind")}>
        <Segmented
          label={t("promos.form.kind")}
          value={form.kind}
          onChange={(kind) =>
            set({
              kind,
              benefit:
                kind === "bundle"
                  ? "percent"
                  : form.benefit === "price" && kind === "bill"
                    ? "percent"
                    : form.benefit,
              value: kind === "bundle" ? 100 : form.value,
            })
          }
          options={[
            { value: "bill", label: t("promos.kind.bill") },
            { value: "items", label: t("promos.kind.items") },
            { value: "bundle", label: t("promos.kind.bundle") },
          ]}
          className="w-full"
        />

        {form.kind === "bundle" ? (
          <div className="grid grid-cols-2 gap-3">
            <Label error={errors.buy_quantity}>
              <p className="text-sm text-muted-foreground">
                {t("promos.form.buy")}
              </p>
              <QtyStepper
                value={form.buy_quantity ?? 1}
                min={1}
                max={20}
                onChange={(buy_quantity) => set({ buy_quantity })}
                labels={{ decrease: "−", increase: "+" }}
              />
            </Label>
            <Label error={errors.get_quantity}>
              <p className="text-sm text-muted-foreground">
                {t("promos.form.get")}
              </p>
              <QtyStepper
                value={form.get_quantity ?? 1}
                min={1}
                max={20}
                onChange={(get_quantity) => set({ get_quantity })}
                labels={{ decrease: "−", increase: "+" }}
              />
            </Label>
          </div>
        ) : (
          <Segmented
            label={t("promos.form.benefit")}
            value={form.benefit}
            onChange={(benefit) => set({ benefit })}
            options={[
              { value: "percent" as const, label: t("promos.benefit.percent") },
              { value: "amount" as const, label: t("promos.benefit.amount") },
              ...(form.kind === "items"
                ? [
                    {
                      value: "price" as const,
                      label: t("promos.benefit.price"),
                    },
                  ]
                : []),
            ]}
            className="w-full"
          />
        )}

        <Label error={errors.value}>
          <p className="text-sm text-muted-foreground">
            {form.kind === "bundle"
              ? t("promos.form.freeValue")
              : form.benefit === "price"
                ? t("promos.form.priceValue")
                : t("promos.form.value")}
          </p>
          {percent ? (
            <div className="relative w-40">
              <Input
                inputMode="numeric"
                value={String(form.value)}
                onChange={(event) =>
                  set({
                    value: Number(event.target.value.replace(/\D/g, "")) || 0,
                  })
                }
                aria-label={t("promos.form.value")}
                aria-invalid={Boolean(errors.value)}
                className="h-12 rounded-xl pr-10 text-base tabular-nums"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
          ) : (
            <MoneyInput
              value={form.value ? String(form.value) : ""}
              onChange={(value) => set({ value: Number(value || 0) })}
              className="h-12 max-w-60 rounded-xl"
            />
          )}
        </Label>

        <div className="grid grid-cols-2 gap-3">
          <Label error={errors.min_spend}>
            <p className="text-sm text-muted-foreground">
              {t("promos.form.minSpend")}
            </p>
            <MoneyInput
              value={form.min_spend ? String(form.min_spend) : ""}
              onChange={(value) => set({ min_spend: Number(value || 0) })}
              className="h-12 rounded-xl"
            />
          </Label>
          <Label error={errors.max_discount}>
            <p className="text-sm text-muted-foreground">
              {t("promos.form.cap")}
            </p>
            <MoneyInput
              value={form.max_discount ? String(form.max_discount) : ""}
              onChange={(value) =>
                set({ max_discount: value ? Number(value) : null })
              }
              placeholder={t("promos.form.noCap")}
              className="h-12 rounded-xl"
            />
          </Label>
        </div>
      </Section>

      {form.kind !== "bill" && (
        <Targets form={form} set={set} error={errors.products} />
      )}

      <Section title={t("promos.form.when")}>
        <div
          role="group"
          aria-label={t("promos.form.days")}
          className="flex flex-wrap gap-2"
        >
          {days.map((name, day) => (
            <Chip
              key={day}
              on={form.weekdays.includes(day)}
              onClick={() => set({ weekdays: toggle(form.weekdays, day) })}
            >
              {name}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("promos.form.daysHint")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Label>
            <p className="text-sm text-muted-foreground">
              {t("promos.form.fromTime")}
            </p>
            <Input
              type="time"
              value={timeValue(form.starts_at)}
              onChange={(event) =>
                set({
                  starts_at: event.target.value
                    ? `${event.target.value}:00`
                    : null,
                })
              }
              className="h-12 rounded-xl text-base"
            />
          </Label>
          <Label error={errors.ends_at}>
            <p className="text-sm text-muted-foreground">
              {t("promos.form.untilTime")}
            </p>
            <Input
              type="time"
              value={timeValue(form.ends_at)}
              onChange={(event) =>
                set({
                  ends_at: event.target.value
                    ? `${event.target.value}:00`
                    : null,
                })
              }
              aria-invalid={Boolean(errors.ends_at)}
              className="h-12 rounded-xl text-base"
            />
          </Label>
          <Label>
            <p className="text-sm text-muted-foreground">
              {t("promos.form.fromDate")}
            </p>
            <Input
              type="date"
              value={form.starts_on ?? ""}
              onChange={(event) =>
                set({ starts_on: event.target.value || null })
              }
              className="h-12 rounded-xl text-base"
            />
          </Label>
          <Label error={errors.ends_on}>
            <p className="text-sm text-muted-foreground">
              {t("promos.form.untilDate")}
            </p>
            <Input
              type="date"
              value={form.ends_on ?? ""}
              min={form.starts_on ?? undefined}
              onChange={(event) => set({ ends_on: event.target.value || null })}
              aria-invalid={Boolean(errors.ends_on)}
              className="h-12 rounded-xl text-base"
            />
          </Label>
        </div>
        <Segmented
          label={t("promos.form.channel")}
          value={form.channel}
          onChange={(channel) => set({ channel })}
          options={[
            { value: "all", label: t("promos.channel.all") },
            { value: "restaurant", label: t("promos.channel.restaurant") },
            { value: "snackbar", label: t("promos.channel.snackbar") },
          ]}
          className="w-full"
        />
      </Section>

      <label className="flex h-14 cursor-pointer items-center justify-between rounded-2xl bg-background px-4">
        <span className="font-medium">{t("promos.form.active")}</span>
        <Switch
          size="lg"
          checked={form.is_active}
          onCheckedChange={(is_active) => set({ is_active })}
        />
      </label>

      <Button
        size="xl"
        className="w-full"
        disabled={save.isPending || upload.isPending}
        onClick={() => void submit()}
      >
        {(save.isPending || upload.isPending) && <Spinner />}
        {promo ? t("promos.form.save") : t("promos.form.create")}
      </Button>
    </div>
  )
}

/** Create or edit a promo. `promo` undefined = closed, null = new. */
export function PromoFormSheet({
  promo,
  onClose,
}: {
  promo: Promo | null | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={promo !== undefined}
      onOpenChange={(open) => !open && onClose()}
      side="center"
      title={
        promo
          ? t("promos.form.editTitle", { name: promo.name })
          : t("promos.form.newTitle")
      }
      description={t("promos.form.body")}
      className="w-[min(640px,calc(100vw-2rem))]"
    >
      {promo !== undefined && (
        <Body key={promo?.id ?? "new"} promo={promo} onDone={onClose} />
      )}
    </TouchSheet>
  )
}
