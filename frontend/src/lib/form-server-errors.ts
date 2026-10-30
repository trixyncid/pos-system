import type { AnyFieldApi, AnyFormApi } from "@tanstack/react-form"

import { apiFieldErrors } from "@/lib/api-error.ts"

/** Form listener: once a field changes, its submit error (client or server) goes away. */
export function clearSubmitErrorOnChange({
  fieldApi,
}: {
  fieldApi: AnyFieldApi
}) {
  if (fieldApi.state.meta.errorMap.onSubmit) {
    fieldApi.setMeta((meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onSubmit: undefined },
    }))
  }
}

/** Put the API's field errors on the matching form fields. Returns whether any were placed. */
export function applyServerErrors(
  form: AnyFormApi,
  error: unknown,
  fields: readonly string[]
) {
  const errors = apiFieldErrors(error)
  let placed = false
  for (const name of fields) {
    const message = errors[name]
    if (!message) continue
    placed = true
    form.setFieldMeta(name, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onSubmit: message },
    }))
  }
  return placed
}
