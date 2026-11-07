#!/bin/sh
# Back up the production database and the uploaded photos. When an off-site
# bucket is set in .env, each file is also copied there (any S3-compatible
# storage: Cloudflare R2, Backblaze B2, DigitalOcean Spaces), so a copy
# survives losing this server. Run it from cron on the VPS, e.g.
#
#   0 17 * * * /srv/pos-system/backend/scripts/backup-postgres.sh >> /srv/pos-system/backend/logs/backup.log 2>&1
#
# Environment (all optional):
#   BACKUP_DIR   where files go             (default: backend/backups)
#   KEEP_DAYS    delete backups older than   (default: 30), here and off-site
#
# .env (all four, or none for local copies only):
#   BACKUP_S3_ENDPOINT    e.g. https://<account>.r2.cloudflarestorage.com
#   BACKUP_S3_BUCKET      e.g. yicipang-pos-backups
#   BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY
#
# Restore a database dump into a running stack (docs/deployment.md):
#   docker compose --env-file .env -f docker-compose.prod.yml exec -T db \
#     sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
#     < backups/pos-<stamp>.dump
#
# Backups hold staff names and every sale. Treat them, and the bucket keys, as secret.
set -eu
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
RCLONE_IMAGE="rclone/rclone:1.68.2"
compose() { docker compose --env-file .env -f docker-compose.prod.yml "$@"; }
env_get() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -n 1; }

umask 077
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$BACKUP_DIR/pos-$stamp.dump"
media="$BACKUP_DIR/media-$stamp.tar.gz"
rclone_env="$(mktemp)"
trap 'rm -f "$dump.partial" "$media.partial" "$rclone_env"' EXIT

# Credentials come from the db container's own environment, so the dump uses
# the same user and database the stack runs with. Custom format is compressed
# and restores with pg_restore. Write to a temp name first, so a failed run
# never leaves a file that looks like a good backup.
compose exec -T db sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$dump.partial"
if [ ! -s "$dump.partial" ]; then
    echo "ERROR: pg_dump produced an empty file" >&2
    exit 1
fi
mv "$dump.partial" "$dump"
echo "Wrote $dump ($(du -h "$dump" | cut -f1))"

compose exec -T api tar -C /app -czf - media > "$media.partial"
mv "$media.partial" "$media"
echo "Wrote $media ($(du -h "$media" | cut -f1))"

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'pos-*.dump' -o -name 'media-*.tar.gz' \) \
    -mtime +"$KEEP_DAYS" -print -delete

bucket="$(env_get BACKUP_S3_BUCKET)"
if [ -z "$bucket" ]; then
    echo "No BACKUP_S3_BUCKET in .env: kept on this server only."
    exit 0
fi

# rclone reads the remote from RCLONE_CONFIG_OFFSITE_*; the keys go through a
# private env file, never the command line (where ps would show them).
cat > "$rclone_env" <<EOF
RCLONE_CONFIG_OFFSITE_TYPE=s3
RCLONE_CONFIG_OFFSITE_PROVIDER=Other
RCLONE_CONFIG_OFFSITE_ENDPOINT=$(env_get BACKUP_S3_ENDPOINT)
RCLONE_CONFIG_OFFSITE_REGION=auto
RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID=$(env_get BACKUP_S3_ACCESS_KEY)
RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY=$(env_get BACKUP_S3_SECRET_KEY)
RCLONE_CONFIG_OFFSITE_NO_CHECK_BUCKET=true
EOF
rclone() {
    # A bucket that can't be reached fails within a minute instead of hanging cron.
    docker run --rm --env-file "$rclone_env" -v "$PWD/$BACKUP_DIR:/backups:ro" "$RCLONE_IMAGE" \
        "$@" --quiet --contimeout 15s --timeout 5m --retries 2
}

for file in "$dump" "$media"; do
    name="$(basename "$file")"
    rclone copyto "/backups/$name" "offsite:$bucket/backups/$name"
    echo "Copied $name to $bucket/backups/"
done
rclone delete --min-age "${KEEP_DAYS}d" "offsite:$bucket/backups/"
