export function fieldErrors(errors: readonly unknown[]) {
  return errors.flatMap((error) => {
    if (typeof error === "string") return [{ message: error }]
    if (error && typeof error === "object" && "message" in error) {
      const message = error.message
      if (typeof message === "string") return [{ message }]
    }
    return []
  })
}
