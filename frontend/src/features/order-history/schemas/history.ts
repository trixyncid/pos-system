import { z } from "zod"

import { orderSchema } from "@/features/ordering/schemas/order.ts"

/** backend orders.serializers.OrderSummarySerializer */
export const orderRowSchema = z.object({
  id: z.uuid(),
  number: z.number(),
  channel: orderSchema.shape.channel,
  type: orderSchema.shape.type,
  table_label: z.string(),
  guests: z.number(),
  status: orderSchema.shape.status,
  waiter: z.string(),
  total: z.number(),
  paid: z.number(),
  items: z.number(),
  summary: z.string(),
  promo_name: z.string(),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  refunded_at: z.string().nullable(),
})
export type OrderRow = z.infer<typeof orderRowSchema>

export const orderPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(orderRowSchema),
})

export type HistoryStatus = "open" | "paid" | "void" | "refunded"
