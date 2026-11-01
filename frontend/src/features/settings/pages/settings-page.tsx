import { useForm, useStore } from "@tanstack/react-form"
import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import {
  useOutletQuery,
  useUpdateOutlet,
} from "@/features/outlet/hooks/use-outlet.ts"
import type { Outlet } from "@/features/outlet/schemas/outlet.ts"
import { DisplaysSection } from "@/features/display/components/displays-section.tsx"
import { ReceiptPreview } from "@/features/settings/components/receipt-preview.tsx"
import {
  settingsFormSchema,
  type SettingsForm,
} from "@/features/settings/schemas/settings.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { fieldErrors } from "@/lib/form-errors.ts"
import { applyServerErrors } from "@/lib/form-server-errors.ts"
import { spring } from "@/lib/motion.ts"

const fieldNames = [
  "name",
  "address",
  "npwpd",
  "pbjt_percent",
  "service_percent",
  "tax_base",
  "cash_rounding",
  "receipt_header",
  "receipt_footer",
] as const

function toForm(outlet: Outlet): SettingsForm {
  return {
    name: outlet.name,
    address: outlet.address,
    npwpd: outlet.npwpd,
    pbjt_percent: outlet.pbjt_percent,
    service_percent: outlet.service_percent,
    tax_base: outlet.tax_base,
    cash_rounding: outlet.cash_rounding,
    receipt_header: outlet.receipt_header,
    receipt_footer: outlet.receipt_footer,
  }
}

/** "10,5" and "10.5" both mean 10.5; an empty box is 0. */
function parsePercent(text: string) {
  const value = Number(text.replace(",", ".").replace(/[^\d.]/g, ""))
  return Number.isFinite(value) ? value : 0
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-6 shadow-(--shadow-soft)">
      <h2 className="mb-5 font-heading text-lg font-semibold">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function SettingsEditor({ outlet }: { outlet: Outlet }) {
  const { t } = useTranslation()
  const save = useUpdateOutlet()
  const defaults = toForm(outlet)

  const form = useForm({
    defaultValues: defaults,
    validators: { onSubmit: settingsFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const saved = await save.mutateAsync(value)
        formApi.reset(toForm(saved))
        toast.success(t("settings.saved"))
      } catch (error) {
        if (!applyServerErrors(formApi, error, fieldNames))
          toast.error(apiErrorMessage(error))
      }
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const dirty = useStore(form.store, (state) => state.isDirty)
  const submitting = useStore(form.store, (state) => state.isSubmitting)

  const textField = (
    name: "name" | "address" | "npwpd",
    label: string,
    hint?: string
  ) => (
    <form.Field name={name}>
      {(field) => (
        <Field data-invalid={field.state.meta.errors.length > 0}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input
            id={field.name}
            className="h-12 rounded-xl text-base"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            aria-invalid={field.state.meta.errors.length > 0}
          />
          {hint && <FieldDescription>{hint}</FieldDescription>}
          <FieldError errors={fieldErrors(field.state.meta.errors)} />
        </Field>
      )}
    </form.Field>
  )

  const percentField = (
    name: "pbjt_percent" | "service_percent",
    label: string,
    hint?: string
  ) => (
    <form.Field name={name}>
      {(field) => (
        <Field data-invalid={field.state.meta.errors.length > 0}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <div className="relative">
            <Input
              id={field.name}
              inputMode="decimal"
              className="h-12 rounded-xl pr-10 text-base tabular-nums"
              value={String(field.state.value)}
              onBlur={field.handleBlur}
              onChange={(event) =>
                field.handleChange(parsePercent(event.target.value))
              }
              aria-invalid={field.state.meta.errors.length > 0}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-muted-foreground">
              %
            </span>
          </div>
          {hint && <FieldDescription>{hint}</FieldDescription>}
          <FieldError errors={fieldErrors(field.state.meta.errors)} />
        </Field>
      )}
    </form.Field>
  )

  const textareaField = (
    name: "receipt_header" | "receipt_footer",
    label: string,
    hint: string
  ) => (
    <form.Field name={name}>
      {(field) => (
        <Field data-invalid={field.state.meta.errors.length > 0}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Textarea
            id={field.name}
            rows={2}
            className="rounded-xl text-base md:text-base"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
          <FieldDescription>{hint}</FieldDescription>
          <FieldError errors={fieldErrors(field.state.meta.errors)} />
        </Field>
      )}
    </form.Field>
  )

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="grid gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="space-y-6">
        <Section title={t("settings.outlet")}>
          {textField("name", t("settings.name"))}
          {textField("address", t("settings.address"))}
          {textField("npwpd", t("settings.npwpd"), t("settings.npwpdHint"))}
        </Section>

        <Section title={t("settings.taxes")}>
          <div className="grid gap-5 sm:grid-cols-2">
            {percentField(
              "pbjt_percent",
              t("settings.pbjt"),
              t("settings.pbjtHint")
            )}
            {percentField("service_percent", t("settings.service"))}
          </div>
          <form.Field name="tax_base">
            {(field) => (
              <Field>
                <FieldLabel>{t("settings.taxBase")}</FieldLabel>
                <Segmented
                  label={t("settings.taxBase")}
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={[
                    { value: "subtotal", label: t("settings.taxBaseSubtotal") },
                    {
                      value: "subtotal_with_service",
                      label: t("settings.taxBaseWithService"),
                    },
                  ]}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="cash_rounding">
            {(field) => (
              <Field>
                <FieldLabel>{t("settings.rounding")}</FieldLabel>
                <Segmented
                  label={t("settings.rounding")}
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={[
                    { value: 1, label: t("settings.roundingNone") },
                    { value: 100, label: "Rp100" },
                    { value: 500, label: "Rp500" },
                  ]}
                />
              </Field>
            )}
          </form.Field>
        </Section>

        <Section title={t("settings.receipt")}>
          {textareaField(
            "receipt_header",
            t("settings.header"),
            t("settings.headerHint")
          )}
          {textareaField(
            "receipt_footer",
            t("settings.footer"),
            t("settings.footerHint")
          )}
        </Section>

        <DisplaysSection />
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="font-heading font-semibold">{t("settings.preview")}</p>
        <p className="mb-5 text-sm text-muted-foreground">
          {t("settings.previewNote")}
        </p>
        <ReceiptPreview
          name={values.name}
          address={values.address}
          npwpd={values.npwpd}
          header={values.receipt_header}
          footer={values.receipt_footer}
          rules={{
            pbjtPercent: values.pbjt_percent,
            servicePercent: values.service_percent,
            taxBase: values.tax_base,
            rounding: values.cash_rounding,
          }}
        />
      </aside>

      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={spring.sheet}
            className="fixed right-4 bottom-4 left-24 z-30 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border bg-card/95 p-3 pl-5 shadow-(--shadow-overlay) backdrop-blur lg:left-[17rem]"
          >
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {t("settings.unsaved")}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              onClick={() => form.reset(defaults)}
            >
              {t("settings.discard")}
            </Button>
            <Button type="submit" size="touch" disabled={submitting}>
              {submitting && <Spinner />}
              {t("common.save")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const outlet = useOutletQuery()
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
      />
      {outlet.isPending ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      ) : outlet.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(outlet.error)}</p>
      ) : (
        <SettingsEditor key={outlet.data.id} outlet={outlet.data} />
      )}
    </div>
  )
}
