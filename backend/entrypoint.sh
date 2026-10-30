#!/bin/sh

set -eu

if [ -z "${DATABASE_URL:-}" ] && [ -n "${SQL_DATABASE:-}" ]; then
    export DATABASE_URL="postgres://${SQL_USER:-postgres}:${SQL_PASSWORD:-}@${SQL_HOST:-db}:${SQL_PORT:-5432}/${SQL_DATABASE}"
fi

APP_UID=1000
APP_GID=1000
mkdir -p /app/media /app/staticfiles
chown -R ${APP_UID}:${APP_GID} /app/media /app/staticfiles 2>/dev/null || true

if [ "${DEBUG:-0}" = "0" ]; then
    if [ -z "${SECRET_KEY:-}" ] || [ "${SECRET_KEY}" = "change-me" ]; then
        echo "ERROR: SECRET_KEY must be set to a secure value in production!"
        exit 1
    fi
    if [ -z "${ALLOWED_HOSTS:-}" ]; then
        echo "ERROR: ALLOWED_HOSTS must be set in production!"
        exit 1
    fi
fi

# Migrations are written and reviewed in development; the container only applies them.
gosu ${APP_UID}:${APP_GID} python manage.py migrate --noinput
gosu ${APP_UID}:${APP_GID} python manage.py seed_roles

if [ "${DEBUG:-0}" = "0" ]; then
    gosu ${APP_UID}:${APP_GID} python manage.py collectstatic --noinput --clear
fi

exec gosu ${APP_UID}:${APP_GID} "$@"
