import { z } from "zod"

export const roleSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
})

export const userSchema = z.object({
  id: z.number(),
  email: z.string().nullable(),
  username: z.string(),
  full_name: z.string(),
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

export const loginSchema = z.object({
  username: z.string().trim().min(1, "validation.enterUsername"),
  password: z.string().min(1, "validation.enterPassword"),
})

export type LoginInput = z.infer<typeof loginSchema>
