import { z } from "zod"

export const ticketLineSchema = z.object({
  quantity: z.number(),
  name: z.string(),
  modifiers: z.array(z.string()),
  note: z.string(),
  seat: z.number().nullable(),
  void_reason: z.string().nullable().optional(),
})

const billSchema = z.object({
  subtotal: z.number(),
  discount: z.number(),
  service: z.number(),
  tax: z.number(),
  rounding: z.number(),
  total: z.number(),
})
export type Bill = z.infer<typeof billSchema>

const shiftSummarySchema = z.object({
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  opened_by: z.string(),
  opening_cash: z.number(),
  cash_sales: z.number(),
  other_sales: z.number(),
  cash_in: z.number(),
  cash_out: z.number(),
  expected_cash: z.number(),
  payments: z.number(),
  counted_cash: z.number().nullable(),
  variance: z.number().nullable(),
  unpaid_bills: z.number(),
  movements: z.array(
    z.object({
      kind: z.enum(["in", "out"]),
      amount: z.number(),
      reason: z.string(),
    })
  ),
})

/** What the API puts in a job (backend printing/tickets.py); the station lays it out. */
export const ticketPayloadSchema = z.object({
  kind: z.enum(["kitchen", "void", "bill", "receipt", "shift", "test"]),
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
  // Bills and receipts (backend printing/tickets.py bill_payload).
  outlet: z
    .object({
      name: z.string(),
      address: z.string(),
      header: z.string(),
      footer: z.string(),
      npwpd: z.string(),
    })
    .optional(),
  line_totals: z.array(z.number()).optional(),
  bill: billSchema.optional(),
  rates: z.object({ service: z.number(), pbjt: z.number() }).optional(),
  discount: z
    .object({
      kind: z.enum(["percent", "amount"]),
      value: z.number(),
      reason: z.string(),
    })
    .nullable()
    .optional(),
  payment: z
    .object({
      method: z.string(),
      amount: z.number(),
      tendered: z.number(),
      change: z.number(),
    })
    .nullable()
    .optional(),
  paid: z.number().optional(),
  // Shift reports.
  shift: shiftSummarySchema.optional(),
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
