import { z } from "zod"

export const ticketLineSchema = z.object({
  quantity: z.number(),
  name: z.string(),
  modifiers: z.array(z.string()),
  note: z.string(),
  seat: z.number().nullable(),
  void_reason: z.string().nullable().optional(),
})

/** What the API puts in a job (backend printing/tickets.py); the station lays it out. */
export const ticketPayloadSchema = z.object({
  kind: z.enum(["kitchen", "void", "bill", "receipt", "test"]),
  station: z.string(),
  order_id: z.string().optional(),
  order_number: z.number().optional(),
  label: z.string().optional(),
  type: z.string().optional(),
  guests: z.number().optional(),
  by: z.string(),
  at: z.string(),
  lines: z.array(ticketLineSchema),
  reprint: z.boolean().optional(),
})
export type TicketPayload = z.infer<typeof ticketPayloadSchema>

export const printJobSchema = z.object({
  id: z.uuid(),
  station: z.string(),
  kind: ticketPayloadSchema.shape.kind,
  status: z.enum(["queued", "printed", "failed"]),
  payload: ticketPayloadSchema,
  attempts: z.number(),
  error: z.string(),
  created_at: z.string(),
  printed_at: z.string().nullable(),
})
export type PrintJob = z.infer<typeof printJobSchema>
