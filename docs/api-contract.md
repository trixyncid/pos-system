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

### Orders (`/orders/`, needs `accounts.take_order`)

Order: `{ id, number, channel, type, table, table_label, guests, status: open|billed|paid|merged|void, waiter, note, subtotal, version, created_at, lines }`.

Line: `{ id, product, name, unit_price, quantity, modifiers: [{group, name, price_delta}], note, seat, station, status: held|sent|void, total, added_by_name, sent_at, void_reason }`.

Names, prices and choices are copied onto each line when it is ordered.

| Method | Path | Notes |
|---|---|---|
| GET | `/orders/?table=` | Orders still holding a table (open or billed) |
| GET | `/orders/{id}/` | |
| POST | `/orders/` | `{ id (client UUID), table, guests, type, channel }`. Idempotent by `id`; one open order per table |
| POST | `/orders/{id}/lines/` | `{ lines: [{ id, product, quantity, modifiers: [option ids], note, seat }], send }`. Choices are checked against the product's groups (min/max); sold-out and archived items are refused; retried line ids are skipped. `send=true` queues tickets |
| POST | `/orders/{id}/send/` | `{ line_ids? }` sends held lines |
| PATCH | `/orders/{id}/lines/{line}/` | `{ quantity?, note?, seat? }`, held lines only |
| POST | `/orders/{id}/lines/{line}/void/` | `{ reason, approver?, approver_pin? }`. A held line is removed. A sent line needs a reason and either `accounts.void_sent_item` or an approver holding `accounts.approve_override` plus that person's PIN. Codes: `approval_required`, `approval_rejected`. A cancellation ticket prints, and the void is audited with the amount and approver |
| POST | `/orders/{id}/move/` | `{ table }`, which must be free; the old table is flagged for cleaning |
| POST | `/orders/{id}/merge/` | `{ source }`. The source's lines and guests join this order; the source becomes `merged` |
| POST | `/orders/{id}/guests/` | `{ guests }` |
| POST | `/orders/{id}/cancel/` | Only when nothing has been sent |
| GET | `/auth/approvers/` | Active staff with a PIN and `approve_override`, for the approval dialog |

Every change publishes `order.changed` on `orders` and `floor.changed` on `floor`. The floor's table status comes from the open order:
- `occupied` when nothing is sent yet
- `ordered` once anything is sent
- `billed` once the bill is printed. Any change to the order (new lines, a void, a merge, a discount) sets it back to open, since the printed bill is then out of date.

#### Checkout

Every order carries its bill, computed by the API in one order (`payments/billing.py`, mirrored by `billTotals` in `frontend/src/lib/money.ts`): subtotal → discount → service → PBJT → cash rounding.

Order fields: `discount_kind: none|percent|amount`, `discount_value`, `discount_reason`, `bill: { subtotal, discount, service, tax, rounding, total }`, `paid`, `remaining`, `payments: [{ id, method, amount, tendered, change, received_by_name, created_at }]`, `billed_at`. Each line has `paid` (settled by a pay-by-item payment; it can no longer be voided).

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/orders/{id}/discount/` | `take_order` | `{ kind, value, reason, approver?, approver_pin? }`. Without `apply_discount`, a manager approves by PIN (`approval_required`, `approval_rejected`). A reason is required. Locked once any payment is taken. `kind: none` removes it. Audited. |
| POST | `/orders/{id}/bill/` | `take_payment` | Prints the bill at the `cashier` station and marks the order `billed`. Refused while lines are held. |
| POST | `/orders/{id}/payments/` | `take_payment` | `{ id, method: cash, tendered, amount?, line_ids? }`. Idempotent by `id`. `line_ids` pays those items plus their share of discount, service and tax; the last unpaid items settle the exact remainder. `amount` pays part of what is left (even split). Neither pays everything left. Needs an open shift (`no_open_shift`). Cash below the amount due is refused. Once fully paid the order is `paid`, the table needs cleaning, and a receipt prints at `cashier`. Audited. |

### Snack bar sales (`/sales/`, needs `accounts.take_payment`)

| Method | Path | Notes |
|---|---|---|
| GET | `/sales/` | Today's paid counter sales, newest first (30) |
| POST | `/sales/` | `{ id, lines: [{ id, product, quantity }], method: cash, tendered }`. One transaction: opens a `snackbar` order, adds and sends the lines (menu items still get kitchen/bar tickets), takes the cash and prints the receipt. Idempotent by `id`. Fails as a whole on `no_open_shift`, a sold-out item or too little cash. Audited as `order.sale`. |

The scanner looks products up on the tablet from the cached catalog (`GET /catalog/products/?kind=retail` and `kind=menu`); `?barcode=` is the exact server-side lookup.

**Tax per line.** Each order line keeps a snapshot of its product's `tax_category`. PBJT is charged only on the `pbjt` part of the bill; retail goods (`ppn`, `none`) are priced tax-inclusive or untaxed. Counter sales (`channel: snackbar`) carry no service charge.

### Inventory (`/inventory/`, needs `accounts.manage_stock`)

Stock lives on tracked products (`track_stock`). `Product.stock` caches the balance of an append-only ledger (`StockMovement`) and is only written next to a new movement, under a row lock.

- **Sales:** sending lines takes stock out: a tracked item itself, and each tracked ingredient of its recipe (`recipe quantity × quantity`). Held lines take nothing until sent. Sales never block on stock, so on hand can go negative until a count corrects it.
- **Voids:** voiding a sent line returns the item's own stock; recipe ingredients stay used (the food may be made).

| Method | Path | Notes |
|---|---|---|
| GET | `/inventory/stock/?search=&kind=ingredient\|retail&status=low\|out` | Paginated. `{ id, name, kind, unit, sku, barcode, category_name, image_url, stock, low_stock_threshold, cost, value, status: ok\|low\|out }` |
| GET | `/inventory/stock/summary/` | `{ tracked, low, out, value }` |
| GET | `/inventory/movements/?product=&kind=` | Paginated ledger, newest first: `{ id, product, product_name, unit, kind: sale\|void\|receive\|waste\|count, quantity (signed), balance, unit_cost, reason, order_number, by_name, created_at }` |
| POST | `/inventory/movements/receive/` | `{ id, supplier, note, lines: [{ product, quantity, unit_cost }] }`. Idempotent by `id`. Moves each item's cost to the weighted average of what was on hand and what arrived. Audited. |
| POST | `/inventory/movements/waste/` | `{ product, quantity, reason }`. Audited. |
| POST | `/inventory/movements/count/` | `{ id, note, lines: [{ product, counted }] }`. A stock count (opname): each counted item is set to what is on the shelf and the difference is kept as a `count` movement. Items not listed are untouched. Idempotent by `id`. Audited. |

Only tracked, active products can be received, wasted or counted.

### Shifts (`/shifts/`)

One drawer, so one open shift at a time. Reading needs any of `open_shift`, `close_shift`, `take_payment` or `open_drawer`.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/shifts/` | any of the above | The 20 most recent, newest first |
| GET | `/shifts/current/` | any of the above | The open shift, or `data: null` |
| POST | `/shifts/` | `open_shift` | `{ opening_cash }` |
| POST | `/shifts/{id}/movements/` | `open_drawer` | `{ kind: in\|out, amount, reason }`. Cash out can't exceed what the drawer should hold. |
| POST | `/shifts/{id}/close/` | `close_shift` | `{ counted_cash, note }`. Freezes `expected_cash`, keeps `variance`, prints the shift report at `cashier`. |

Shift: `{ id, created_at, opened_by_name, opening_cash, closed_at, closed_by_name, counted_cash, expected_cash, variance, note, totals: { cash_sales, other_sales, cash_in, cash_out, expected_cash, payments }, movements: [{ id, kind, amount, reason, by_name, created_at }] }`. Open, cash in/out and close are audited.

### Printing (`/printing/jobs/`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/printing/jobs/?status=&station=` | `print_station` | Last 100, oldest first |
| POST | `/printing/jobs/{id}/ack/` | `print_station` | `{ status: printed\|failed, error }` |
| POST | `/printing/jobs/{id}/reprint/` | `reprint` | A copy marked `reprint: true`, audited |
| POST | `/printing/jobs/test/` | `print_station` | `{ station }` |

Job: `{ id, station, kind: kitchen|void|bill|receipt|shift|test, status, payload, attempts, error, created_at, printed_at }`.

- The payload holds everything the ticket shows (label, number, by, time, lines with choices, note, seat and void reason), so the station never looks anything up.
- Bills, receipts and shift reports go to the `cashier` station. Their payload adds the outlet header, `line_totals`, `bill`, `rates`, `discount`, `payment` and `paid` (or `shift` for a report).
- One kitchen job is queued per station (`kitchen`, `bar`); lines whose category prints nowhere (`none`, the snack bar) get no job.
- New jobs publish `print.job` on the `print` stream.

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

Floor (areas, tables), catalog (categories, products, modifiers, recipes), print jobs, staff and roles, reports, audit log.
