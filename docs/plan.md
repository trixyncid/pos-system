# Restaurant POS — Plan (frontend first, backend boilerplate)

## Context
This is a web-based POS for one restaurant plus a snack bar in the same outlet, built mainly for tablets. It covers:
- Waiters and cashiers taking orders, with kitchen tickets printing automatically.
- A floor plan the owner can edit, showing which tables are free or busy.
- A snack bar counter driven by a barcode scanner.
- One inventory shared by the restaurant and the snack bar.
- An owner dashboard.
- Staff roles built on Django's Group/Permission system.

The code is split into `backend/` (Django) and `frontend/` (React), like the user's other projects.
- **This phase:** the full frontend, running on a mocked API (MSW), with a modern, motion-rich design that works well on tablets. The Django side is a production-grade skeleton only.
- **Next phase:** build the real backend endpoints to the same contract.

### Reference projects
| Project | What we take from it |
|---|---|
| `membership` | Main code-practice reference: stack versions, API envelope, session-cookie refresh, idempotent sales, CI gates, Caddy, Prettier, theming tokens and fonts |
| `yanksandbrits` | Staff, role and permission system: Group + GroupProfile, permission catalog, `<Can>`, page catalog, role access matrix |
| `kms-connect` | Pieces membership doesn't have: Channels WebSocket auth, append-only audit app, Redis and Celery wiring |

### Decisions so far
| Topic | Decision |
|---|---|
| Tablets | Mixed: iPad and Android |
| Kitchen printer | LAN/Wi-Fi ESC/POS |
| Printing | One **Android "Print Station"** tablet runs the React app inside Capacitor and prints to the LAN printer with no dialog. Customer receipts use the same path. |
| Outlets | Single outlet |
| Offline | The design allows for it now; built in phase 2 |
| Payments in v1 | Cash only |
| UI | Modern and motion-rich, shadcn, stock photos in the mockups |

## Repo layout (one monorepo, as in membership)
```
pos-system/
  .github/workflows/  ci.yml (backend gates + frontend lint/typecheck/test/e2e)
  backend/            Django boilerplate
  frontend/           React tablet SPA, MSW mocks, Capacitor android shell (later milestone)
  docs/               architecture.md, api-contract.md, permissions.md, printing.md, design.md
```

---

## Frontend (main focus)

### Stack
Versions follow membership. The parts specific to a POS are added on top.
- **Core:** bun, Vite 8, React 19.3, TypeScript 6 (membership's strict tsconfig).
  - Imports always use the `@/` alias with explicit file extensions.
  - Prettier with no semicolons and `prettier-plugin-tailwindcss`.
  - ESLint 10 flat config.
- **Routing and data:**
  - **TanStack Router** (your earlier pick), using `beforeLoad` guards as in yanksandbrits.
    - Membership uses React Router 8 `createBrowserRouter`. Say if you'd rather match membership exactly. Only the router layer changes.
  - TanStack Query, Form and Table (v9 API like membership), axios, zod 4.
  - Zustand only for the cart and the terminal session (which tablet, which staff member).
- **UI:**
  - Tailwind 4 with **shadcn** (`radix-nova` style, oklch tokens with `success`/`warning`/`danger` + `-ink` shades, as in membership).
  - lucide-react and sonner.
  - **vaul** for drawers you can drag closed.
  - Fonts: Inter Variable for text, Lexend Deca Variable for headings and numbers. Use tabular figures for prices.
- **Motion:**
  - **`motion`** (motion.dev, formerly framer-motion) for layout and shared-element animation, springs and gestures.
  - Membership's `tw-animate-css` and CSS keyframes (`rise-in`, `pop-in`, `sheet-up`) for simple entrances.
  - `<MotionConfig reducedMotion="user">` plus the `prefers-reduced-motion` CSS guard.
- **POS-specific:**
  - `react-konva` for the floor plan.
  - `@dnd-kit` for reordering.
  - `@point-of-sale/receipt-printer-encoder` to build ESC/POS bytes.
  - `recharts` (with shadcn's chart component) for the dashboard.
  - `thumbhash` for blurred image placeholders.
  - `i18next`: Bahasa Indonesia by default, English as an option.
- **Testing:** `msw@2`, Vitest with Testing Library, and Playwright on tablet-sized screens. Membership has no frontend tests; we add them.

### Ported from membership
- `lib/api.ts`:
  - The access token lives only in memory.
  - The refresh cookie is set through `X-Session-Cookie: 1`.
  - Tabs refresh one at a time behind `navigator.locks`.
  - A 401 refreshes once and retries; a network error does not log the user out.
- `lib/api-error.ts` reads the `{success, detail, errors, code}` envelope. `lib/form-server-errors.ts` (`applyServerErrors`) maps field errors back onto forms.
- `hooks/use-url-list-params.ts`: list filters, search and paging live in the URL, with `keepPreviousData`.
- `theme-provider.tsx`, the CSS tokens, and `components/motion/*`.

### Folder layout
Feature folders, a pattern from yanksandbrits. File naming inside each folder follows membership.
```
src/
  app/          router.tsx, providers.tsx, query-client.ts, layouts/ (PosShell, BackofficeShell)
  components/   ui/ (shadcn), motion/ (RiseIn, PopIn, Presence, CountUp, Pressable), pos/ (NumPad, QtyStepper, MoneyText, StatusPill, BigButton, ProductImage)
  lib/          api.ts, api-error.ts, env.ts (zod-validated), money.ts (IDR int), format.ts, idempotency.ts (uuid v7), scanner.ts, haptics.ts
  realtime/     ws client (kms-connect Sec-WebSocket-Protocol auth) + mock event bus
  features/<name>/{api,hooks,components,pages,schemas,types}
     auth, floor, ordering, checkout, snackbar, kitchen, printing, menu, inventory,
     shifts, dashboard, reports, staff, roles, settings, audit
  mocks/        browser.ts, handlers/<feature>.ts, db/ (seeded fixtures), realtime.ts
public/mock/    stock photos (optimized .webp) + CREDITS.md
```

### Visual and motion design (`docs/design.md`)
**General principles**
- Landscape first (1180×820 iPad, 1280×800 Android). Portrait must still work.
- Touch targets of at least 48px, with primary actions at 56–64px.
- Reachable areas: the cart and its main action sit on the right edge, near the thumb.
- No actions that only appear on hover.
- Light theme by default with a warm neutral palette and one brand accent. Dark mode for evening service.
- Images: generous rounded corners and soft elevation. Food photos are the hero of the menu.

**Order screen.** This is where the most design effort goes.
- **Layout:** three panes.
  - **Left:** a vertical category rail with icon and label. The active pill slides between items using a motion `layoutId` indicator.
  - **Centre:** a grid of photo cards (4:3 photo, name, price, a "Habis" sold-out ribbon, a favourites row at the top) with a search bar fixed at the top.
  - **Right:** the cart panel, which stays in place.
- **Adding items:**
  - Tapping a card runs a press-scale spring (0.96).
  - Simple items go straight into the cart. A small thumbnail flies into the cart, and the cart badge pops.
  - Items with modifiers open a sheet. The card photo expands into the sheet's hero image (shared `layoutId`).
- **Item sheet:**
  - Large photo, description, and modifier groups as chip toggles. Required groups are highlighted until chosen.
  - Notes with quick-tag chips ("tidak pedas", "tanpa es").
  - Quantity stepper and seat selector.
  - An "Add · Rp xx.xxx" button whose price animates as options change.
- **Cart:**
  - Lines slide in using `AnimatePresence` with layout animation. Swipe left to void or delete, which needs approval if the item was already sent.
  - Long-press a line to edit it.
  - Held items show a dashed outline and a "Fire" chip.
  - Totals count up or down with `CountUp`.
  - The main button "Kirim ke Dapur (n)" changes into a "Terkirim ✓" confirmation.
- **Feedback:**
  - A sonner toast with Undo for 5 seconds after sending.
  - Skeletons, plus a thumbhash blur that fades into the real photo.
  - Optional sound and vibration where the device supports it (`navigator.vibrate` on Android).

**Floor view**
- Tables are drawn as shapes. Status colours change smoothly.
- Occupied tables show a live timer ring and guest count.
- Area tabs use a sliding indicator, and the plan supports pinch-zoom and pan.
- Tapping a table opens a quick-action sheet: open, transfer, merge, print bill, mark clean.

**Checkout**
- Bill on the left; on the right, a large keypad with quick cash buttons (exact, 50k, 100k).
- Change is shown in a large animated figure. Payment success shows a check and a progress bar, then returns to the floor.

**Snack bar**
- Each scan adds a line with a highlight flash. An unknown barcode shakes the line and shows an "add product?" shortcut.

**Backoffice**
- Calmer motion: page `rise-in`, data tables, and dashboard KPI cards with count-up and charts that animate in once.

**Stock photos**
- About 40 food and drink photos and about 40 snack products from **Unsplash or Pexels** (free licence).
- Stored locally in `public/mock/` as resized webp files (400px and 800px), so the CSP stays strict and the mocks work offline.
- Sources and credits are listed in `CREDITS.md`. I'll ask before downloading them in M1.
- Real menu photos replace them later through the upload flow.

**Implementation skills to apply:** `emil-design-eng`, `animate`, `apple-design` (gestures and springs), `mobile-native` (100vh, tap highlight, input zoom), and `break-ui` (long names and huge counts) for every POS screen.

### Screens
1. **Device login and PIN lock**
   - A manager signs the tablet in once with email and password.
   - Staff unlock with a 4–6 digit PIN on a full-screen keypad with dot animations and a shake on a wrong PIN.
   - The tablet locks itself after it sits idle, and staff can switch quickly.
2. **Floor view** — as described above, with live status over WebSocket.
3. **Floor editor** (manager) — drag, resize, rotate and snap tables, set shape, capacity and label, and manage areas on a 1000×700 logical canvas.
4. **Order screen**
   - Modifiers, notes, seat, guest count, dine-in or takeaway.
   - Send or hold per item, plus "Fire held".
   - Transfer, merge, and split by item, seat or evenly.
5. **Checkout**
   - Subtotal, discount, service charge, PBJT, rounding.
   - Cash with change calculation. The data model is ready for QRIS, EDC and split payments, but only cash appears in v1.
   - Voids and discounts after an item is sent need a manager PIN and a reason.
6. **Snack bar** — a keyboard-wedge scanner feeds the cart (`lib/scanner.ts` buffers keys arriving under 50 ms apart that end in Enter). Camera scanning is the fallback. Sales are tagged `channel=snackbar`.
7. **Print Station** — the live job queue, printer health, test print, reprint, and failed jobs with retry.
8. **Shifts** — open with starting cash, record cash in/out with a reason, close with a counted amount and the variance, and print a shift report.
9. **Inventory**
   - One stock list for ingredients and retail SKUs, with low-stock filters.
   - A movement ledger, receiving, stock opname (stock count), waste.
   - Recipe-based (BOM) deduction on each sale.
10. **Owner dashboard**
    - Sales vs yesterday and last week, orders, average ticket, covers.
    - Sales by hour, item mix, restaurant vs snack bar.
    - Table turnover, food cost %, voids and discounts by staff, low stock.
11. **Reports** — filter by date and export CSV.
12. **Staff and roles** — staff CRUD, PIN reset, and the role access matrix ported from yanksandbrits.
13. **Settings** — outlet details and NPWPD (regional tax ID), tax mode, service %, rounding, receipt template, printers and routing.
14. **Audit log** — voids, discounts, price changes, reprints, cash out, failed logins.

### Permissions (ported from yanksandbrits)
- A role is a `Group` plus a `GroupProfile`. Actions are Django permission codenames.
- `/auth/me` returns `permissions: string[]` (or `['*']` for full access).
- `page-catalog.ts` is the single source for the sidebar, the route guards and the role matrix.
- POS action permissions are declared on a proxy model: `accounts.void_sent_item` (on the `PosAccess` proxy), `apply_discount`, `approve_override`, `reprint`, `open_drawer`, `edit_floor`, `close_shift`, `view_dashboard`, `manage_stock`.
- Seeded roles: Owner, Manager, Cashier, Waiter, Print Station, Inventory.
- The UI checks permissions only, never role codes. This avoids the yanksandbrits `managerOnly` bug.

### Mock API as the contract
- `docs/api-contract.md` defines the endpoints and payloads using membership's response envelope.
- Zod schemas in `features/*/schemas` are the source of the types.
- MSW serves seeded fixtures:
  - The menu with photos, 2 areas with 14 tables, about 40 snack SKUs with barcodes.
  - Staff for each role, and 30 days of generated sales.
- Realtime events run on an in-memory event bus that matches the WebSocket client's interface.
- `VITE_USE_MOCKS=true` switches the mocks on; turning them off later is an env change only.

### Printing
```
Any tablet ─POST send─▶ API ─PrintJob(s) routed category→printer─▶ WS group outlet_print
                                                                      │
          Android Print Station (Capacitor) ◀─────────────────────────┘
            encoder → ESC/POS bytes → TcpTransport (raw :9100 → LAN printer) → ACK printed/failed
```
- `PrintTransport` has three methods: `connect`, `print` and `status`.
- Transports:
  - `PreviewTransport`: renders the ticket on screen, used in dev and mock mode.
  - `CapacitorTcpTransport`: sends to the LAN printer from the Print Station.
  - Optional later: `WebBluetoothTransport`.
- Ticket templates (kitchen, bar, receipt, shift report) are pure functions, so they can be unit tested.
- Jobs are keyed by UUID, so they are idempotent and can be retried. Reprints are explicit.
- If the station goes offline, a banner appears on every tablet.

### Money and tax (`lib/money.ts`, mirrored in the backend)
- IDR is stored as an integer.
- Order of calculation: subtotal → discounts → service charge → PBJT.
  - The PBJT rate is set per outlet, at most 10%.
  - Whether PBJT is charged on the service charge is a per-outlet option.
  - Each product has a tax category, so retail items can use PPN or none.
- Cash is rounded to Rp100 or Rp500 and shown as a "Pembulatan" line.

### Offline-ready (built in phase 2)
- Client-generated UUID v7 for orders, lines and payments.
- An `Idempotency-Key` header on every write, matching membership's unique constraint on (outlet, idempotency_key).
- Writes go through a wrapper shaped like an outbox, so a PWA and Dexie outbox can be added later without touching feature code.

---

## Backend boilerplate (this phase)
Membership's conventions are the base. The extra parts a POS needs are noted as additions.

- **Dependencies:** Python 3.12 everywhere (fixing membership's 3.14 vs 3.12 mismatch). Pinned `requirements.txt`:
  - Django 5.2 LTS, DRF 3.18, simplejwt with blacklist, drf-spectacular (docs only when DEBUG or `API_DOCS_PUBLIC`), psycopg 3, gunicorn, sentry-sdk, django-storages.
  - **Additions:** channels, channels-redis, uvicorn worker for ASGI, redis, ruff (`ruff.toml`).
  - Celery is left out at first. Membership's `dispatch.after_commit` thread pool is enough until reports or exports need a queue.
- **Settings:** membership's single `backend/settings.py`, read from `os.environ`.
  - Fail fast on an unsafe production config.
  - Cache: locmem in dev, **Redis** in prod (needed for Channels anyway).
  - `id`, Asia/Jakarta.
  - Console logging plus Sentry.
- **Apps and layout:**
  - **Our choice, not membership's:** DRF serializers with ViewSets, split into small per-audience view modules in membership's style. A POS has many CRUD resources.
  - `common`:
    - `BaseModel`: UUID primary key, `created_at` and `updated_at`, verbose names and help text.
    - Membership's `exceptions.py` envelope, `ApiPagination` and the `ordered()` whitelist.
    - Throttle scopes.
    - `RequirePermission` and `ModelPermissions` (from yanksandbrits).
    - `dispatch.after_commit`.
  - `accounts`:
    - Email user with a **hashed** PIN (yanksandbrits stores it in plain text) and PIN lockout.
    - `GroupProfile`, `permission_catalog`, the `PosAccess` proxy permissions, `RoleService`.
    - Membership's `session_cookie.py` refresh flow.
  - `audit`: append-only `AuditEvent` with `emit()` and `AuditedMixin` (from kms-connect).
  - Empty domain apps whose planned models are listed in docstrings: `outlet`, `floor`, `catalog`, `orders`, `payments`, `shifts`, `inventory`, `printing`, `reports`.
  - API under `/api/v1/` with a `urls.py` per app.
- **Realtime:** ASGI `ProtocolTypeRouter`, kms-connect's WebSocket JWT auth (`Sec-WebSocket-Protocol`), and a stub `OutletConsumer` with groups `floor`, `orders` and `print`.
- **Operations:**
  - Membership's multi-stage Dockerfile: non-root user with gosu, `HEALTHCHECK /health/`, an entrypoint that runs migrate and never makemigrations.
  - Compose files: dev runs api, Postgres and Redis; prod adds **Caddy** (WebSocket proxy, security headers) and resource limits.
- **CI:** copy membership's workflow:
  - `check`, `makemigrations --check`, `check --deploy`, `manage.py test` on Postgres, Caddy validate, GHCR build, SSH deploy with a pinned host key.
  - Add ruff and a frontend job.
- **Tests:** Django `TestCase` with flat `test_<feature>.py` files, as in membership.

### Planned domain model (`docs/architecture.md`, built next phase)
| Area | Models |
|---|---|
| Outlet | `Outlet` (singleton with tax, service and rounding settings), `Device`, `Printer` (ip:port, width, role) |
| Floor | `Area`, `Table` (shape, x, y, w, h, rotation, capacity) |
| Catalog | `Category` (printer route), `Product` (kind: menu, retail or ingredient; barcode, price, tax category, unit, track_stock, image), `ModifierGroup`, `Modifier`, `RecipeLine` |
| Orders | `Order` (UUID, channel, type, table, guests, status, version, idempotency_key), `OrderLine` (name and price snapshot, modifiers JSON, seat, course, held/sent/void, fired_at), `KitchenTicket` |
| Payments and shifts | `Payment`, `Shift`, `CashMovement` |
| Inventory | `StockMovement` ledger, with stock on hand cached on `Product` and updated under `select_for_update` |
| Other | `PrintJob`, `AuditEvent` |

---

## Milestones (frontend phase)
| Milestone | Scope |
|---|---|
| M0 | Monorepo scaffold, tooling, CI, Docker dev stack, docs skeleton, MSW wiring |
| M1 | Design system: tokens, fonts, shadcn, motion primitives, POS components, stock photo set. POS and backoffice shells, i18n, login, PIN lock, permission guards and `<Can>` |
| M2 | Settings, staff, roles (access matrix) |
| M3 | Menu and catalog: products with photos, modifiers, barcodes, recipes, printer routing |
| M4 | Floor editor and live floor view |
| M5 | Order screen with full motion; kitchen tickets via `PreviewTransport`; Print Station page |
| M6 | Checkout (cash, discount approval, rounding), receipts, shifts and the cash drawer |
| M7 | Snack bar barcode POS |
| M8 | Inventory |
| M9 | Dashboard, reports, audit log |
| M10 | Capacitor Android shell with TCP printing, tested against a real LAN printer |

**Next phase:** backend endpoints built to `docs/api-contract.md`, then the mocks are switched off.

## Verification
- **Frontend**
  - `bun run lint`, `bun run typecheck` and `bun run test` (Vitest): money and tax, the scanner buffer, ticket encoders, route access.
  - `bun run e2e` (Playwright, iPad 1180×820 and Android 1280×800):
    - PIN → table → items with modifiers → send → ticket preview → cash pay → table becomes free.
    - Snack bar scan → pay.
    - Voiding a sent item needs the manager PIN.
  - Visual check of every screen in the browser pane at tablet size, in light, dark and reduced-motion modes.
  - Run the break-ui worst-case data pass.
- **Backend**
  - `docker compose up` comes up healthy and `/health/` returns 200.
  - `/api/v1/docs/` loads in dev.
  - `ruff check` passes.
  - `manage.py check --deploy` and `makemigrations --check` pass.
  - `manage.py test` passes: cookie login, refresh and logout, permissions in `/me`, PIN lockout, the audit log rejecting updates, the WebSocket auth handshake.
- **M10:** an order sent from an iPad prints in the kitchen by itself through the Android Print Station.
