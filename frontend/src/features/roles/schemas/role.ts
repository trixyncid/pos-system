import { z } from "zod"

export const roleSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  is_system: z.boolean(),
  permissions: z.array(z.string()),
  member_count: z.number(),
})

export type Role = z.infer<typeof roleSchema>

export const permissionSchema = z.object({
  codename: z.string(),
  name: z.string(),
})

export type PermissionInfo = z.infer<typeof permissionSchema>

export const roleFormSchema = z.object({
  name: z.string().trim().min(1, "Nama peran wajib diisi."),
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Huruf kecil, angka dan tanda hubung saja."),
  description: z.string(),
  permissions: z.array(z.string()),
})

export type RoleForm = z.infer<typeof roleFormSchema>

/** A readable, stable code from a role name: "Kasir Malam" -> "kasir-malam". */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}
