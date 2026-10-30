import { api } from "@/lib/api.ts"
import { outletSchema, type Outlet } from "@/features/outlet/schemas/outlet.ts"

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

export async function updateOutlet(changes: Partial<Outlet>) {
  const { data } = await api.patch<{ success: true; data: unknown }>(
    "/outlet/",
    changes
  )
  return outletSchema.parse(data.data)
}
