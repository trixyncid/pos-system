import { z } from "zod"

/** Every area is drawn on this logical canvas and scaled to the screen. */
export const CANVAS = { width: 1000, height: 700 } as const

export const tableStatusSchema = z.enum([
  "available",
  "occupied",
  "ordered",
  "billed",
])
export type TableStatus = z.infer<typeof tableStatusSchema>

export const tableSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  shape: z.enum(["rect", "round"]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  capacity: z.number(),
  status: tableStatusSchema,
  seated_at: z.string().nullable(),
  guests: z.number().nullable(),
  order_total: z.number().nullable(),
  waiter: z.string().nullable(),
  /** The open order holding this table, if any. */
  order_id: z.uuid().nullable(),
})
export type FloorTable = z.infer<typeof tableSchema>

export const areaSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sort_order: z.number(),
  is_active: z.boolean(),
  tables: z.array(tableSchema),
})
export type Area = z.infer<typeof areaSchema>

/** What the editor saves: geometry only; status belongs to the server. */
export type TableLayout = Pick<
  FloorTable,
  | "id"
  | "label"
  | "shape"
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "capacity"
>
