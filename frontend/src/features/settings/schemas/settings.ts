import { z } from "zod"

import { taxBaseSchema } from "@/features/outlet/schemas/outlet.ts"

export const settingsFormSchema = z.object({
  name: z.string().trim().min(1, "Nama outlet wajib diisi."),
  address: z.string(),
  npwpd: z.string().trim().max(40),
  pbjt_percent: z
    .number({ message: "Isi angka." })
    .min(0, "Tidak boleh minus.")
    .max(10, "PBJT maksimal 10%."),
  service_percent: z
    .number({ message: "Isi angka." })
    .min(0, "Tidak boleh minus.")
    .max(100, "Maksimal 100%."),
  tax_base: taxBaseSchema,
  cash_rounding: z.union([z.literal(1), z.literal(100), z.literal(500)]),
  receipt_header: z.string().max(300),
  receipt_footer: z.string().max(300),
  idle_lock_minutes: z.number().int().min(1).max(60),
})

export type SettingsForm = z.infer<typeof settingsFormSchema>
