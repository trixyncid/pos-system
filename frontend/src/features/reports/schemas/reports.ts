import { z } from "zod"

/** backend reports.services.Figures.as_dict */
export const figuresSchema = z.object({
  orders: z.number(),
  covers: z.number(),
  gross: z.number(),
  discount: z.number(),
  service: z.number(),
  tax: z.number(),
  rounding: z.number(),
  sales: z.number(),
  net: z.number(),
  cost: z.number(),
  food_cost_percent: z.number().nullable(),
  average_ticket: z.number(),
})
export type Figures = z.infer<typeof figuresSchema>

const comparisonSchema = z.object({
  date: z.string(),
  sales: z.number(),
  orders: z.number(),
  /** Only up to the same time of day, because the day shown is still going. */
  partial: z.boolean(),
})

const nameRow = z.object({ name: z.string() })

export const dashboardSchema = figuresSchema.extend({
  date: z.string(),
  yesterday: comparisonSchema,
  last_week: comparisonSchema,
  hourly: z.array(z.number()).length(24),
  channels: z.object({ restaurant: figuresSchema, snackbar: figuresSchema }),
  top_items: z.array(
    nameRow.extend({ quantity: z.number(), revenue: z.number() })
  ),
  waiters: z.array(nameRow.extend({ orders: z.number(), sales: z.number() })),
  voids: z.array(nameRow.extend({ count: z.number(), amount: z.number() })),
  discounts: z.array(nameRow.extend({ count: z.number(), amount: z.number() })),
  table_turns: z.number().nullable(),
  low_stock: z.number(),
})
export type Dashboard = z.infer<typeof dashboardSchema>

export const salesDaySchema = figuresSchema.extend({ date: z.string() })
export type SalesDay = z.infer<typeof salesDaySchema>

export const itemRowSchema = z.object({
  product: z.string(),
  name: z.string(),
  kind: z.enum(["menu", "retail", "ingredient"]),
  channel_restaurant: z.number(),
  channel_snackbar: z.number(),
  quantity: z.number(),
  revenue: z.number(),
  /** Null for a menu item with no recipe yet: its cost is unknown. */
  cost: z.number().nullable(),
  margin: z.number().nullable(),
})
export type ItemRow = z.infer<typeof itemRowSchema>

const report = <T extends z.ZodType>(row: T) =>
  z.object({ from: z.string(), to: z.string(), rows: z.array(row) })

export const salesReportSchema = report(salesDaySchema)
export const itemsReportSchema = report(itemRowSchema)
