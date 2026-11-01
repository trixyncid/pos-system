import { useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { RiseIn } from "@/components/motion/rise-in.tsx"
import { BRAND, BrandMark, MeanderBand } from "@/components/pos/brand.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { PasswordInput } from "@/components/ui/password-input.tsx"
import {
  LanguageMenu,
  ThemeSwitch,
} from "@/features/shell/components/preferences.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { homePath } from "@/features/auth/lib/route-access.ts"
import { loginSchema } from "@/features/auth/schemas/auth.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { apiErrorCode, apiErrorMessage } from "@/lib/api-error.ts"
import { env } from "@/lib/env.ts"
import { fieldErrors } from "@/lib/form-errors.ts"
import { applyServerErrors } from "@/lib/form-server-errors.ts"

const demoAccounts = [
  { label: "Owner", username: "rina" },
  { label: "Kasir", username: "budi" },
  { label: "Pelayan", username: "sari" },
]

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signIn = useSession((state) => state.signIn)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { username: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null)
      try {
        const user = await signIn(value)
        toast.success(t("auth.welcome", { name: user.full_name }))
        await navigate({ to: homePath(user), replace: true })
      } catch (error) {
        if (applyServerErrors(formApi, error, ["username", "password"])) {
          toast.error(t("auth.checkFields"))
          return
        }
        const message =
          apiErrorCode(error) === "invalid_credentials"
            ? t("auth.invalidCredentials")
            : apiErrorMessage(error)
        setFormError(message)
        toast.error(message)
      }
    },
  })

  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[1.1fr_1fr]">
      {/* The bowl from the logo: brand red, its key-pattern rim, the chef in the middle. */}
      <section className="relative hidden overflow-hidden bg-brand text-white lg:flex lg:flex-col">
        <MeanderBand className="text-white/25" />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 left-1/2 size-[70%] -translate-x-1/2 rounded-full bg-brand-gold/20 blur-3xl"
        />
        <RiseIn className="relative flex flex-1 flex-col items-center justify-center gap-8 px-12 text-center">
          <BrandMark size="xl" />
          <div className="space-y-2">
            <p className="font-heading text-5xl font-semibold tracking-wide">
              {BRAND.hanzi}
            </p>
            <p className="font-heading text-xl font-medium text-white/85">
              {BRAND.name}
            </p>
          </div>
          <div className="max-w-md space-y-3">
            <p className="font-heading text-2xl leading-snug font-semibold text-balance">
              {t("auth.heroTitle")}
            </p>
            <p className="text-base text-white/75">{t("auth.heroBody")}</p>
          </div>
        </RiseIn>
        <div className="relative bg-brand-deep/60 px-12 py-4 text-center text-sm text-white/80">
          {t("auth.heroFooter")}
        </div>
        <MeanderBand className="text-white/25" />
      </section>

      <section className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <LanguageMenu />
          <ThemeSwitch />
        </div>
        <RiseIn className="w-full max-w-sm">
          {/* On a narrow screen the brand panel is hidden, so the mark sits above the form. */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size="lg" />
            <div>
              <p className="font-heading text-xl font-semibold">{BRAND.name}</p>
              <p className="text-sm text-muted-foreground">{BRAND.hanzi}</p>
            </div>
          </div>
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
            <form.Field name="username">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>
                    {t("auth.username")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
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
                  <PasswordInput
                    id={field.name}
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
                    key={account.username}
                    type="button"
                    variant="outline"
                    size="touch"
                    onClick={() => {
                      form.setFieldValue("username", account.username)
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
