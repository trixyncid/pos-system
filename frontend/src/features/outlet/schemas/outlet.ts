import { z } from "zod"

/** How PBJT is charged: on the subtotal only, or on the subtotal plus service charge. */
export const taxBaseSchema = z.enum(["subtotal", "subtotal_with_service"])

export const outletSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  npwpd: z.string(),
  pbjt_percent: z.number().min(0).max(10),
  service_percent: z.number().min(0).max(100),
  tax_base: taxBaseSchema,
  cash_rounding: z.union([z.literal(1), z.literal(100), z.literal(500)]),
})

export type Outlet = z.infer<typeof outletSchema>
