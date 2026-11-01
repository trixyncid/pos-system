import { z } from "zod"

export const staffSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  is_active: z.boolean(),
  roles: z.array(z.number()),
  role_names: z.array(z.string()),
  /** Has a password set, so can sign in. */
  can_sign_in: z.boolean(),
  last_login: z.string().nullable(),
  date_joined: z.string(),
})

export type Staff = z.infer<typeof staffSchema>

export const staffPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(staffSchema),
})

export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,29}$/

/**
 * The staff form. Everyone signs in with their own username and password; a
 * new account needs both, and an empty password on an existing one means
 * "leave it as is".
 */
export function staffFormSchema(isNew: boolean) {
  return z
    .object({
      full_name: z.string().trim().min(1, "validation.name"),
      username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(usernamePattern, "validation.username"),
      email: z.union([z.literal(""), z.email("validation.email")]),
      password: z.union([z.literal(""), z.string().min(8, "validation.min8")]),
      roles: z.array(z.number()),
      is_active: z.boolean(),
    })
    .refine((value) => !isNew || value.password, {
      path: ["password"],
      message: "validation.newPassword",
    })
}

export type StaffForm = z.infer<ReturnType<typeof staffFormSchema>>
