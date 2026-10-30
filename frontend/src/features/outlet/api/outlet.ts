import { api } from "@/lib/api.ts"
import { outletSchema } from "@/features/outlet/schemas/outlet.ts"

export const outletKeys = {
  all: ["outlet"] as const,
  detail: () => [...outletKeys.all, "detail"] as const,
}

export async function getOutlet(signal?: AbortSignal) {
  const { data } = await api.get<{ success: true; data: unknown }>("/outlet/", {
    signal,
  })
  return outletSchema.parse(data.data)
}
