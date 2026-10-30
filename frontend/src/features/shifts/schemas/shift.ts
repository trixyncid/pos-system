import { z } from "zod"

export const movementSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["in", "out"]),
  amount: z.number(),
  reason: z.string(),
  by_name: z.string(),
  created_at: z.string(),
})
export type CashMovement = z.infer<typeof movementSchema>

export const shiftSchema = z.object({
  id: z.uuid(),
  created_at: z.string(),
  opened_by_name: z.string(),
  opening_cash: z.number(),
  closed_at: z.string().nullable(),
  closed_by_name: z.string().nullable(),
  counted_cash: z.number().nullable(),
  expected_cash: z.number().nullable(),
  variance: z.number().nullable(),
  note: z.string(),
  totals: z.object({
    cash_sales: z.number(),
    other_sales: z.number(),
    cash_in: z.number(),
    cash_out: z.number(),
    refunds: z.number(),
    expected_cash: z.number(),
    payments: z.number(),
  }),
  movements: z.array(movementSchema),
})
export type Shift = z.infer<typeof shiftSchema>
