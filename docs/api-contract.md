# API contract

The frontend is built against MSW mocks (`frontend/src/mocks`) before the backend exists. This file is the agreement both sides follow. Zod schemas in `frontend/src/features/*/schemas` are the type source, and DRF serializers must produce the same shapes.

## Conventions

- Base path: `/api/v1/`. Trailing slashes on every path.
- IDs: UUIDs for POS records (orders, lines, payments, print jobs), created on the tablet as UUID v7. Integer IDs for users and roles (Django auth).
- Money: whole rupiah as integers. Percentages as numbers (`10`, `5.5`).
- Times: ISO 8601 with offset, server time zone Asia/Jakarta.
- Writes that create money records send `Idempotency-Key: <uuid>`. A replay returns the first result.

## Envelopes

| Case | Body |
|---|---|
| Single resource or action | `{ "success": true, "data": {...} }` |
| List | `{ "success": true, "count", "next", "previous", "results": [...] }` (`page`, `page_size` ≤ 100) |
| Error | `{ "success": false, "detail": "One sentence", "errors"?: { "field": ["msg"] }, "code"?: "machine_reason" }` |

The frontend reads `detail` for toasts (`apiErrorMessage`) and `errors` for forms (`applyServerErrors`).

## Auth

The web app sends `X-Session-Cookie: 1`, so the refresh token lives in an httpOnly cookie (`pos_refresh`, path `/api/v1/auth/`). The access token stays in memory only.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/login/` | `{ email, password }` | `{ success, access, expires_in, user }` and the refresh cookie |
| POST | `/auth/pin-unlock/` | `{ user_id, pin }` (needs a signed-in tablet) | Same as login, for that staff member. A wrong PIN gives 403 with `code` set to `pin_incorrect`, `pin_locked` or `pin_unavailable` |
| POST | `/auth/refresh/` | none (cookie) | `{ success, access }` and a rotated cookie |
| POST | `/auth/logout/` | none (cookie) | `{ success }`, with the cookie cleared and the token blacklisted |
| GET | `/auth/me/` | none | `{ success, data: user }` |
| GET | `/auth/lock-staff/` | none (needs a signed-in tablet) | `{ success, data: [{ id, full_name, role }] }`: active staff who have a PIN, for the lock screen |

`user`: `{ id, email, full_name, has_pin, is_superuser, roles: [{id, code, name}], permissions: ["accounts.take_order", ...] | ["*"] }`

## Implemented

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/outlet/` | signed in | `{ id, name, address, npwpd, pbjt_percent, service_percent, tax_base, cash_rounding, receipt_header, receipt_footer, idle_lock_minutes }` |
| PATCH | `/outlet/` | `accounts.manage_settings` | Partial update. `pbjt_percent` is at most 10; `idle_lock_minutes` is 1–60 |
| GET | `/permissions/` | `accounts.manage_staff` | `[{ codename: "accounts.take_order", name }]`, the assignable catalog |
| GET | `/roles/` | `accounts.manage_staff` | `[{ id, name, code, description, is_system, permissions: [codename], member_count }]`, not paginated |
| POST / PATCH | `/roles/`, `/roles/{id}/` | `accounts.manage_staff` | `{ name, code, description, permissions: [codename] }`. A built-in role keeps its code; the Owner role's permissions are fixed |
| DELETE | `/roles/{id}/` | `accounts.manage_staff` | Only a non-built-in role with no active staff |
| GET | `/staff/?search=&active=true\|false&page=` | `accounts.manage_staff` | Paginated `{ id, full_name, email\|null, is_active, roles: [id], role_names, has_pin, can_sign_in, last_login, date_joined }` |
| POST / PATCH | `/staff/`, `/staff/{id}/` | `accounts.manage_staff` | `{ full_name, email?, password?, pin?, roles: [id], is_active }`. Email is optional (PIN-only staff); a password needs an email. No delete: deactivate instead, which signs the account out everywhere |
| POST | `/staff/{id}/set-pin/` | `accounts.manage_staff` | `{ pin }` (4–6 digits) |

Escalation rules (both the API and the mock enforce them): nobody can grant a permission or give a role that does more than they can themselves, edit or reset the PIN of someone who can do more than them, deactivate themselves, change their own roles, or remove their own access to staff and roles.

## Realtime

`wss://<api>/ws/outlet/`, opened with `new WebSocket(url, ["pos-auth", accessToken])`. Tokens are never sent in the query string.

- Client sends `{ "type": "subscribe", "stream": "floor" | "orders" | "print" }`.
- Server replies `{ "type": "subscribed", stream }` or `{ "type": "error", detail }`.
- Events arrive as `{ "type": "event", stream, event: {...} }`.

| Stream | Permission |
|---|---|
| `floor`, `orders` | `accounts.take_order` |
| `print` | `accounts.print_station` |

## Planned (filled in milestone by milestone)

Floor (areas, tables), catalog (categories, products, modifiers, recipes), orders (open, add lines, send, hold/fire, void, transfer, merge, split), payments, shifts and cash movements, inventory movements, print jobs, staff and roles, reports, audit log.
