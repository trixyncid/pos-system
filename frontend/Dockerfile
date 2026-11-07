# syntax=docker/dockerfile:1.7

# The production web image: Caddy serving the built React app, and proxying
# /api, /ws, /admin and /health to the Django container (see backend/caddy).
# VITE_API_URL stays empty, so the app calls its own origin.

FROM oven/bun:1.3.9-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV VITE_USE_MOCKS=false
RUN bun run build

FROM caddy:2.10.2-alpine
COPY --from=build /app/dist /srv/app
