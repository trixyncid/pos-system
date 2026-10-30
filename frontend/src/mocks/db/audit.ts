import type { AuditEvent } from "@/features/audit/schemas/audit.ts"

/** backend audit.AuditEvent, newest last. */
export const auditEvents: AuditEvent[] = []
let nextId = 1

export function audit(
  action: string,
  actor: { id: number; full_name: string } | null,
  target_label = "",
  metadata: Record<string, unknown> = {},
  at = new Date().toISOString()
) {
  auditEvents.push({
    id: nextId++,
    created_at: at,
    actor: actor?.id ?? null,
    actor_name: actor?.full_name ?? "",
    action,
    target_type: "",
    target_id: "",
    target_label,
    ip_address: "192.168.1.20",
    metadata,
  })
}
