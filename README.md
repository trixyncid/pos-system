# POS System

A tablet-first point of sale for a restaurant and its snack bar. It covers ordering, kitchen printing, the floor plan, barcode sales, inventory and the owner dashboard.

| Folder | What |
|---|---|
| `frontend/` | React 19 + Vite SPA (TanStack Router/Query/Form, shadcn, motion), MSW mocks |
| `backend/` | Django 5.2 + DRF + Channels API (Postgres, Redis) |
| `docs/` | [Plan](docs/plan.md), [architecture](docs/architecture.md), [API contract](docs/api-contract.md), [permissions](docs/permissions.md), [printing](docs/printing.md), [design](docs/design.md) |

## Frontend

```bash
cd frontend
bun install
bun run dev:mock      # http://localhost:3000, every API call served by MSW
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

Without Docker (SQLite, in-memory channels):

```bash
cd backend
python3 -m venv env && env/bin/pip install -r requirements-dev.txt
DEBUG=1 env/bin/python manage.py migrate
DEBUG=1 env/bin/python manage.py seed_roles
DEBUG=1 env/bin/uvicorn backend.asgi:application --reload --port 8000
```

- API docs: `http://localhost:8000/api/v1/docs/` (DEBUG only).
- Health check: `/health/`.
- Tests: `DEBUG=1 env/bin/python manage.py test`.
- Lint: `env/bin/ruff check . && env/bin/ruff format --check .`.
