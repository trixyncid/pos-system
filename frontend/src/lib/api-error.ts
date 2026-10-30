import axios from "axios"

export function apiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === "string" && detail.length > 0) return detail
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return "The server took too long to answer. Check your connection and try again."
    }
    if (!error.response && error.code !== "ERR_CANCELED") {
      return "Could not reach the server. Check your connection and try again."
    }
  }
  return "Something went wrong. Try again."
}

/** Field errors from a 400 response, first message per field: `{ email: "Another account..." }`. */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {}
  const errors: unknown = error.response?.data?.errors
  if (!errors || typeof errors !== "object") return {}
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(errors)) {
    const first = Array.isArray(messages) ? messages[0] : messages
    if (typeof first === "string") result[field] = first
  }
  return result
}

export function apiStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

/** Machine-readable reason on an error response, such as `wrong_portal`. */
export function apiErrorCode(error: unknown) {
  if (!axios.isAxiosError(error)) return undefined
  const code: unknown = error.response?.data?.code
  return typeof code === "string" ? code : undefined
}

/** Message for a failed sign-in: the API's answer, or the reason a provider popup gave. */
export function signInErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error) && error instanceof Error && error.message)
    return error.message
  return apiErrorMessage(error)
}
