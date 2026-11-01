# POS System

A tablet-first point of sale for a restaurant and its snack bar. It covers ordering, kitchen printing, the floor plan, barcode sales, inventory and the owner dashboard.

| Folder | What |
|---|---|
| `frontend/` | React 19 + Vite SPA (TanStack Router/Query/Form, shadcn, motion), MSW mocks |
| `backend/` | Django 5.2 + DRF + Channels API (Postgres, Redis) |
| `print-agent/` | Small Windows program on the cashier PC that sends tickets to the LAN/USB printers ([README](print-agent/README.md)) |
| `scripts/windows/` | Cashier PC setup: kiosk windows, customer display, print agent |
| `docs/` | [Plan](docs/plan.md), [architecture](docs/architecture.md), [API contract](docs/api-contract.md), [permissions](docs/permissions.md), [printing](docs/printing.md), [design](docs/design.md), [cashier PC setup](docs/cashier-pc-setup.md) |

## Local development

The usual setup is the backend in Docker with the demo outlet seeded, and the frontend talking to it:

```bash
cd backend
cp .env.example .env
docker compose up --build -d
docker compose exec -u 1000 api python manage.py seed_demo   # demo outlet; --reset wipes and reseeds
```

```bash
cd frontend
bun install
cp .env.example .env.local   # VITE_USE_MOCKS=false: the real API
bun run dev                  # http://localhost:3000; Vite proxies /api and /ws to :8000
```

Sign in as `rina` (Owner), `budi` (Kasir) or `sari` (Pelayan); the password is `demo1234`. `seed_demo` loads the same menu, photos, floor, staff, promos, stock, open tables, shifts and thirty days of sales as the frontend's mock API (`backend/outlet/demo.py` mirrors `frontend/src/mocks/db`).

## Frontend

```bash
cd frontend
bun install
bun run dev:mock      # http://localhost:3000, every API call served by MSW (no backend needed)
```

Other commands: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run e2e`, `bun run build`.

To test on a real tablet, open `http://<this-machine-ip>:3000` from a device on the same Wi-Fi.

## Backend

With Docker (Postgres and Redis included):

```bash
cd backend
cp .env.example .env
docker compose up --build
```

The outlet's time zone is `TIME_ZONE` in `.env` (`Asia/Makassar` for Samarinda); business days, shifts and reports follow it.

Without Docker (SQLite, in-memory channels):

```bash
cd backend
python3 -m venv env && env/bin/pip install -r requirements-dev.txt
DEBUG=1 env/bin/python manage.py migrate
DEBUG=1 env/bin/python manage.py seed_demo
DEBUG=1 env/bin/uvicorn backend.asgi:application --reload --port 8000
```

- API docs: `http://localhost:8000/api/v1/docs/` (DEBUG only).
- Health check: `/health/`.
- Tests: `DEBUG=1 env/bin/python manage.py test`.
- Lint: `env/bin/ruff check . && env/bin/ruff format --check .`.
