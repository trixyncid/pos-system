import { z } from "zod"

import { taxBaseSchema } from "@/features/outlet/schemas/outlet.ts"

export const settingsFormSchema = z.object({
  name: z.string().trim().min(1, "validation.outletName"),
  address: z.string(),
  npwpd: z.string().trim().max(40),
  pbjt_percent: z
    .number({ message: "validation.number" })
    .min(0, "validation.notNegative")
    .max(10, "validation.pbjtMax"),
  service_percent: z
    .number({ message: "validation.number" })
    .min(0, "validation.notNegative")
    .max(100, "validation.max100"),
  tax_base: taxBaseSchema,
  cash_rounding: z.union([z.literal(1), z.literal(100), z.literal(500)]),
  receipt_header: z.string().max(300),
  receipt_footer: z.string().max(300),
})

export type SettingsForm = z.infer<typeof settingsFormSchema>
