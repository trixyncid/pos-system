import { z } from "zod"

import { kindSchema, unitSchema } from "@/features/catalog/schemas/catalog.ts"

export const stockStatusSchema = z.enum(["ok", "low", "out"])
export type StockStatus = z.infer<typeof stockStatusSchema>

export const stockItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: kindSchema,
  unit: unitSchema,
  sku: z.string(),
  barcode: z.string().nullable(),
  category_name: z.string().nullable(),
  image_url: z.string().nullable(),
  stock: z.number(),
  low_stock_threshold: z.number().nullable(),
  cost: z.number(),
  value: z.number(),
  status: stockStatusSchema,
})
export type StockItem = z.infer<typeof stockItemSchema>

export const movementKindSchema = z.enum([
  "sale",
  "void",
  "receive",
  "waste",
  "count",
  "refund",
])
export type MovementKind = z.infer<typeof movementKindSchema>

export const movementSchema = z.object({
  id: z.uuid(),
  product: z.uuid(),
  product_name: z.string(),
  unit: unitSchema,
  kind: movementKindSchema,
  quantity: z.number(),
  balance: z.number(),
  unit_cost: z.number().nullable(),
  reason: z.string(),
  order_number: z.number().nullable(),
  by_name: z.string(),
  created_at: z.string(),
})
export type Movement = z.infer<typeof movementSchema>

const page = <T extends z.ZodType>(item: T) =>
  z.object({
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  })

export const stockPageSchema = page(stockItemSchema)
export const movementPageSchema = page(movementSchema)

export const stockSummarySchema = z.object({
  tracked: z.number(),
  low: z.number(),
  out: z.number(),
  value: z.number(),
})
export type StockSummary = z.infer<typeof stockSummarySchema>
