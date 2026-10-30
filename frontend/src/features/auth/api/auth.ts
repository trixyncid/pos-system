import { z } from "zod"

import {
  lockStaffSchema,
  sessionSchema,
  userSchema,
  type LoginInput,
} from "@/features/auth/schemas/auth.ts"
import { api } from "@/lib/api.ts"

export const authKeys = {
  all: ["auth"] as const,
  lockStaff: () => [...authKeys.all, "lock-staff"] as const,
}

export async function login(input: LoginInput) {
  const { data } = await api.post("/auth/login/", input)
  return sessionSchema.parse(data)
}

export async function pinUnlock(input: { user_id: number; pin: string }) {
  const { data } = await api.post("/auth/pin-unlock/", input)
  return sessionSchema.parse(data)
}

export async function getMe() {
  const { data } = await api.get<{ data: unknown }>("/auth/me/")
  return userSchema.parse(data.data)
}

export async function logout() {
  await api.post("/auth/logout/")
}

export async function listLockStaff(signal?: AbortSignal) {
  const { data } = await api.get<{ data: unknown }>("/auth/lock-staff/", {
    signal,
  })
  return z.array(lockStaffSchema).parse(data.data)
}
