import { useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRightIcon, StoreIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { RiseIn } from "@/components/motion/rise-in.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { homePath } from "@/features/auth/lib/route-access.ts"
import { loginSchema } from "@/features/auth/schemas/auth.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { env } from "@/lib/env.ts"
import { fieldErrors } from "@/lib/form-errors.ts"
import { applyServerErrors } from "@/lib/form-server-errors.ts"

const demoAccounts = [
  { label: "Owner", email: "owner@warungsenja.test" },
  { label: "Manager", email: "manager@warungsenja.test" },
]

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signIn = useSession((state) => state.signIn)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null)
      try {
        const user = await signIn(value)
        await navigate({ to: homePath(user), replace: true })
      } catch (error) {
        if (!applyServerErrors(formApi, error, ["email", "password"]))
          setFormError(apiErrorMessage(error))
      }
    },
  })

  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[oklch(0.3_0.06_45)] p-12 text-[oklch(0.97_0.01_75)] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/4 -left-1/4 size-[80%] rounded-full bg-[oklch(0.62_0.16_42/0.45)] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-1/4 -bottom-1/3 size-[70%] rounded-full bg-[oklch(0.75_0.14_85/0.25)] blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/10 backdrop-blur">
            <StoreIcon className="size-5" />
          </span>
          <span className="font-heading text-lg font-medium">Warung Senja</span>
        </div>
        <RiseIn className="relative max-w-md">
          <p className="font-heading text-4xl leading-tight font-semibold text-balance">
            Pesanan cepat, dapur tahu seketika.
          </p>
          <p className="mt-4 text-base text-white/70">
            Denah meja, snack bar, stok dan laporan pemilik dalam satu tablet.
          </p>
        </RiseIn>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <RiseIn className="w-full max-w-sm">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {t("auth.signInTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("auth.signInBody")}</p>

          <form
            className="mt-8 space-y-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field name="email">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>
                    {t("auth.email")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    type="email"
                    autoComplete="username"
                    inputMode="email"
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
            <form.Field name="password">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>
                    {t("auth.password")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    type="password"
                    autoComplete="current-password"
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

            {formError && (
              <p role="alert" className="animate-shake text-sm text-danger-ink">
                {formError}
              </p>
            )}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button
                  type="submit"
                  size="xl"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? <Spinner /> : null}
                  {submitting ? t("auth.signingIn") : t("auth.signIn")}
                  {!submitting && <ArrowRightIcon data-icon="inline-end" />}
                </Button>
              )}
            </form.Subscribe>
          </form>

          {env.useMocks && (
            <div className="mt-8 rounded-2xl border border-dashed p-4 text-sm">
              <p className="text-muted-foreground">
                Mock API · password <span className="font-mono">demo1234</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {demoAccounts.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="touch"
                    onClick={() => {
                      form.setFieldValue("email", account.email)
                      form.setFieldValue("password", "demo1234")
                    }}
                  >
                    {account.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </RiseIn>
      </section>
    </main>
  )
}
