import { z } from "zod"

export const lineSchema = z.object({
  id: z.uuid(),
  product: z.uuid(),
  name: z.string(),
  unit_price: z.number(),
  quantity: z.number(),
  modifiers: z.array(
    z.object({ group: z.string(), name: z.string(), price_delta: z.number() })
  ),
  note: z.string(),
  seat: z.number().nullable(),
  station: z.string(),
  status: z.enum(["held", "sent", "void"]),
  total: z.number(),
  added_by_name: z.string(),
  sent_at: z.string().nullable(),
  void_reason: z.string(),
  /** PBJT is charged only on "pbjt" lines; retail goods are PPN-inclusive or untaxed. */
  tax_category: z.enum(["pbjt", "ppn", "none"]),
  /** Settled by a split payment (pay by item); it can no longer be voided. */
  paid: z.boolean(),
})
export type OrderLine = z.infer<typeof lineSchema>

export const billSchema = z.object({
  subtotal: z.number(),
  discount: z.number(),
  service: z.number(),
  tax: z.number(),
  rounding: z.number(),
  total: z.number(),
})
export type Bill = z.infer<typeof billSchema>

export const paymentSchema = z.object({
  id: z.uuid(),
  method: z.string(),
  amount: z.number(),
  tendered: z.number(),
  change: z.number(),
  received_by_name: z.string(),
  created_at: z.string(),
})
export type Payment = z.infer<typeof paymentSchema>

export const orderSchema = z.object({
  id: z.uuid(),
  number: z.number(),
  channel: z.enum(["restaurant", "snackbar"]),
  type: z.enum(["dine_in", "takeaway"]),
  table: z.uuid().nullable(),
  table_label: z.string(),
  guests: z.number(),
  status: z.enum(["open", "billed", "paid", "merged", "void", "refunded"]),
  waiter: z.string(),
  note: z.string(),
  subtotal: z.number(),
  discount_kind: z.enum(["none", "percent", "amount"]),
  discount_value: z.number(),
  discount_reason: z.string(),
  /** One discount per bill: a promo (by name) or the manual discount above. */
  promo: z.uuid().nullable(),
  promo_name: z.string(),
  /** A paid order taken back, with who did it and who approved it. */
  refunded_at: z.string().nullable(),
  refund_reason: z.string(),
  refunded_by_name: z.string().nullable(),
  refund_approved_by_name: z.string().nullable(),
  closed_at: z.string().nullable(),
  /** Computed by the API in the same order as billTotals(): the tablet never sums money itself. */
  bill: billSchema,
  paid: z.number(),
  remaining: z.number(),
  payments: z.array(paymentSchema),
  billed_at: z.string().nullable(),
  version: z.number(),
  created_at: z.string(),
  lines: z.array(lineSchema),
})
export type Order = z.infer<typeof orderSchema>

export const approverSchema = z.object({
  id: z.number(),
  full_name: z.string(),
})
export type Approver = z.infer<typeof approverSchema>

/** A line on this tablet that has not reached the API yet. */
export type DraftLine = {
  id: string
  product: string
  name: string
  image: string | null
  unit_price: number
  quantity: number
  modifiers: { id: string; group: string; name: string; price_delta: number }[]
  note: string
  seat: number | null
  /** Saved without sending to the kitchen (a course that comes later). */
  hold: boolean
}
