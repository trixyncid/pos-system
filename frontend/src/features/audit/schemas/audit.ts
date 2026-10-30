import { z } from "zod"

export const auditEventSchema = z.object({
  id: z.number(),
  created_at: z.string(),
  actor: z.number().nullable(),
  actor_name: z.string(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string(),
  target_label: z.string(),
  ip_address: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
})
export type AuditEvent = z.infer<typeof auditEventSchema>

export const auditPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(auditEventSchema),
})
