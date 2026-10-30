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
})
export type OrderLine = z.infer<typeof lineSchema>

export const orderSchema = z.object({
  id: z.uuid(),
  number: z.number(),
  channel: z.enum(["restaurant", "snackbar"]),
  type: z.enum(["dine_in", "takeaway"]),
  table: z.uuid().nullable(),
  table_label: z.string(),
  guests: z.number(),
  status: z.enum(["open", "billed", "paid", "merged", "void"]),
  waiter: z.string(),
  note: z.string(),
  subtotal: z.number(),
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
