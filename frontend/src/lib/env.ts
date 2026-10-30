import { z } from "zod"

const schema = z.object({
  // Empty in local dev: Vite proxies /api to the Django server.
  VITE_API_URL: z.string().trim().optional(),
  // "true" serves every API call from the MSW mocks in src/mocks.
  VITE_USE_MOCKS: z.enum(["true", "false"]).optional(),
})

const parsed = schema.safeParse(import.meta.env)
if (!parsed.success) {
  throw new Error(`Invalid frontend environment: ${parsed.error.message}`)
}

const apiUrl = parsed.data.VITE_API_URL

export const env = {
  apiUrl: apiUrl ? apiUrl.replace(/\/$/, "") : "/api/v1",
  useMocks: parsed.data.VITE_USE_MOCKS === "true",
}
