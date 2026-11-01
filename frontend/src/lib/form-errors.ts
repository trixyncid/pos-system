import i18n from "@/lib/i18n.ts"

/**
 * Form errors for <FieldError>. A schema message that is a translation key
 * ("validation.name") is shown in the current language; anything else (the
 * server's own field messages) is shown as it came.
 */
export function fieldErrors(errors: readonly unknown[]) {
  const shown = (message: string) =>
    i18n.exists(message) ? (i18n.t(message as never) as string) : message
  return errors.flatMap((error) => {
    if (typeof error === "string") return [{ message: shown(error) }]
    if (error && typeof error === "object" && "message" in error) {
      const message = error.message
      if (typeof message === "string") return [{ message: shown(message) }]
    }
    return []
  })
}
