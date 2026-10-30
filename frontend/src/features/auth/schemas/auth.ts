import { z } from "zod"

export const roleSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
})

export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  full_name: z.string(),
  has_pin: z.boolean(),
  is_superuser: z.boolean(),
  roles: z.array(roleSchema),
  /** "app_label.codename" strings, or ["*"] for an account with every permission. */
  permissions: z.array(z.string()),
})

export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  access: z.string(),
  user: userSchema,
})

/** A staff tile on the lock screen. */
export const lockStaffSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  role: z.string(),
})

export type LockStaff = z.infer<typeof lockStaffSchema>

export const loginSchema = z.object({
  email: z.email("Masukkan email yang benar."),
  password: z.string().min(1, "Masukkan kata sandi."),
})

export type LoginInput = z.infer<typeof loginSchema>
