import { v7 as uuidv7 } from "uuid"

/**
 * A time-ordered id made on the tablet. Orders, lines and payments carry one
 * from the moment they are created, so a retried request (flaky Wi-Fi, or the
 * offline outbox later) is recognised by the API instead of creating a duplicate.
 */
export function newId() {
  return uuidv7()
}

/** Header the API checks against its (outlet, idempotency_key) unique constraint. */
export function idempotencyHeaders(key: string) {
  return { "Idempotency-Key": key }
}
