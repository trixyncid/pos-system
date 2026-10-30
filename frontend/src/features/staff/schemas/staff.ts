import { z } from "zod"

export const staffSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  email: z.string().nullable(),
  is_active: z.boolean(),
  roles: z.array(z.number()),
  role_names: z.array(z.string()),
  has_pin: z.boolean(),
  /** Has email and password, so can sign a tablet in (not only unlock one). */
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

const pinPattern = /^\d{4,6}$/

/** The staff form. Empty strings mean "leave as is" for password and PIN. */
export const staffFormSchema = z
  .object({
    full_name: z.string().trim().min(1, "Nama wajib diisi."),
    email: z.union([z.literal(""), z.email("Masukkan email yang benar.")]),
    password: z.union([
      z.literal(""),
      z.string().min(8, "Minimal 8 karakter."),
    ]),
    pin: z.union([
      z.literal(""),
      z.string().regex(pinPattern, "PIN 4–6 angka."),
    ]),
    roles: z.array(z.number()),
    is_active: z.boolean(),
  })
  .refine((value) => !value.password || value.email, {
    path: ["password"],
    message: "Isi email dulu: kata sandi hanya untuk masuk ke tablet.",
  })

export type StaffForm = z.infer<typeof staffFormSchema>

export const pinSchema = z.string().regex(pinPattern, "PIN 4–6 angka.")
