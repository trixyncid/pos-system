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

### Catalog (`/catalog/`)

Every signed-in tablet may read; writing needs `accounts.manage_settings`. Lists are not paginated (`{ success, data: [...] }`), since the whole catalog is cached on each tablet.

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH/DELETE | `/catalog/categories/` | `{ id, name, station: kitchen\|bar\|none, sort_order, is_active, product_count }`. A category with products cannot be deleted |
| POST | `/catalog/categories/reorder/` | `{ ids: [uuid] }` sets `sort_order` in that order |
| GET/POST/PATCH | `/catalog/products/?kind=menu,retail,ingredient&category=&search=&barcode=&active=true\|false\|all` | See the product shape below. `barcode` is an exact match for the snack-bar scanner |
| DELETE | `/catalog/products/{id}/` | Archives (`is_active=false`); past orders keep pointing at it |
| POST/DELETE | `/catalog/products/{id}/image/` | Multipart `image` (JPG/PNG/WebP, ≤ 10 MB). Stored as a 1200×900 WebP with EXIF removed |
| GET/POST/PATCH/DELETE | `/catalog/modifier-groups/` | `{ id, name, min_select, max_select, options: [{ id?, name, price_delta }], product_count }`. `options` replaces the list; existing ids are kept |

Product: `{ id, kind, name, description, category, category_name, price, cost, unit: portion|pcs|g|ml, barcode, sku, tax_category: pbjt|ppn|none, track_stock, low_stock_threshold, image_url, is_available, is_favorite, is_active, sort_order, modifier_groups: [uuid], recipe: [{ ingredient, ingredient_name, unit, quantity, cost }], recipe_cost }`.

- Menu and retail products need a category.
- Ingredients never have a category, a price, tax or modifiers.
- Recipe lines must point at active ingredients, each used once.
- Barcodes are unique.
- Price and availability changes are written to the audit log with their before and after values.

### Floor (`/floor/`)

Every signed-in tablet may read; layout changes need `accounts.edit_floor`.

| Method | Path | Notes |
|---|---|---|
| GET | `/floor/areas/?all=true` | Areas with their tables (inactive areas only with `all=true`), not paginated |
| POST / PATCH / DELETE | `/floor/areas/`, `/floor/areas/{id}/` | `{ name, is_active }`. Deleting an area deletes its tables |
| PUT | `/floor/areas/{id}/layout/` | `{ tables: [{ id?, label, shape, x, y, width, height, rotation, capacity }] }` replaces the area's tables: known ids are updated, new rows created, missing ones removed. Labels are unique across all areas; two tables can swap labels in one save |
| POST | `/floor/tables/{id}/clean/` | `accounts.take_order`. Clears "needs cleaning" |

Table: `{ id, label, shape: rect|round, x, y, width, height, rotation, capacity, status, seated_at, guests, order_total, waiter }`.

- `x` and `y` are the table's centre on the area's 1000×700 canvas.
- `status` is one of `available`, `occupied`, `ordered`, `billed` or `cleaning`. Until orders exist (M5), the API reports only `available` or `cleaning`, and the occupancy fields are null.
- Every change publishes `{ type: "floor.changed" }` on the `floor` stream, so tablets can refetch.

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
