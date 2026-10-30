# Architecture

```
Tablets (iPad / Android, React SPA) ──HTTPS /api/v1──▶ Caddy ──▶ Django (ASGI: uvicorn workers)
        ▲                                   │                         │        │
        └──────────── WSS /ws/outlet/ ──────┘                     Postgres   Redis (cache + channel layer)
Android Print Station (Capacitor) ── WSS "print" stream ──▶ raw TCP :9100 ──▶ LAN ESC/POS printer
```

The full plan is in [plan.md](plan.md).

## Backend layout (`backend/`)

| Path | Role |
|---|---|
| `backend/` | Settings (environment only, fails fast in production), URLs, ASGI/WSGI, CORS middleware, `/health/` |
| `common/` | `BaseModel` (UUID primary key and timestamps), error envelope, pagination, `RequirePermission`, `ok()`, `dispatch.after_commit` |
| `accounts/` | Email user with a hashed PIN and lockout, `GroupProfile`, `PosAccess` permissions, roles seeding, cookie-JWT auth views |
| `audit/` | Append-only `AuditEvent`, `emit()` with secrets redacted |
| `realtime/` | WebSocket JWT auth (subprotocol), `OutletConsumer`, `publish()` |
| `outlet/` | Single `Outlet` row: tax, service charge, rounding |
| `floor/`, `catalog/`, `orders/`, `payments/`, `shifts/`, `inventory/`, `printing/`, `reports/` | Stubs. Each one's `models.py` docstring lists its planned models |

## Planned domain model

| Area | Models |
|---|---|
| Outlet | `Outlet`, `Device`, `Printer` (ip:port, paper width, role) |
| Floor | `Area`, `Table` (shape, x, y, w, h, rotation, capacity) on a 1000×700 logical canvas |
| Catalog | `Category` (printer route), `Product` (kind: menu, retail or ingredient; barcode, price, tax category, unit, track_stock, image), `ModifierGroup`, `Modifier`, `RecipeLine` |
| Orders | `Order` (UUID from the tablet, channel, type, table, guests, status, version, idempotency_key), `OrderLine` (name and price snapshot, modifiers JSON, seat, course, held/sent/void, fired_at), `KitchenTicket` |
| Payments and shifts | `Payment`, `Shift`, `CashMovement` |
| Inventory | `StockMovement` ledger. Stock on hand is cached on `Product` and updated under `select_for_update` |
| Printing | `PrintJob` (UUID, printer, kind, payload JSON, status, attempts) |

## Money and tax

Amounts are whole-rupiah integers. The calculation order is:

1. Subtotal
2. Discounts
3. Service charge
4. PBJT. The rate is set per outlet (at most 10%). Whether it is charged on the service charge too is set per outlet.
5. Cash rounding (Rp100 or Rp500), shown as its own "Pembulatan" line.

`frontend/src/lib/money.ts` and the backend must give identical results.

## Frontend layout (`frontend/src/`)

| Path | Role |
|---|---|
| `app/` | Router (TanStack Router), pages for the shells |
| `components/` | shadcn `ui/`, `motion/` primitives, POS components (M1) |
| `lib/` | `api.ts` (in-memory access token, cookie refresh, `navigator.locks`), `api-error.ts`, `env.ts` (zod), `money.ts`, `idempotency.ts` |
| `features/<name>/` | `api/`, `hooks/`, `components/`, `pages/`, `schemas/` |
| `mocks/` | MSW handlers and seeded data, shared by the browser, Vitest and Playwright |
